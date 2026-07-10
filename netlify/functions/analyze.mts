import {
  getApiKey,
  getModel,
  getOutputText,
  openAiFetch,
  toUserMessage,
} from "../lib/openai.mts";

const schema = {
  type: "object",
  properties: {
    sourceLanguage: { type: "string", enum: ["hebrew", "japanese", "other"] },
    inputType: { type: "string", enum: ["word", "sentence", "expression"] },
    original: { type: "string" },
    correctedJapanese: { type: "string" },
    isNaturalJapanese: { type: "boolean" },
    hiraganaReading: { type: "string" },
    romaji: { type: "string" },
    hebrewTranslation: { type: "string" },
    shortExplanationHebrew: { type: "string" },
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          japanese: { type: "string" },
          hiragana: { type: "string" },
          romaji: { type: "string" },
          meaningHebrew: { type: "string" },
          functionHebrew: { type: "string" },
        },
        required: ["japanese", "hiragana", "romaji", "meaningHebrew", "functionHebrew"],
        additionalProperties: false,
      },
    },
    grammarPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          form: { type: "string" },
          explanationHebrew: { type: "string" },
        },
        required: ["form", "explanationHebrew"],
        additionalProperties: false,
      },
    },
    exampleJapanese: { type: "string" },
    exampleHiragana: { type: "string" },
    exampleRomaji: { type: "string" },
    exampleHebrew: { type: "string" },
    learningTipHebrew: { type: "string" },
  },
  required: [
    "sourceLanguage",
    "inputType",
    "original",
    "correctedJapanese",
    "isNaturalJapanese",
    "hiraganaReading",
    "romaji",
    "hebrewTranslation",
    "shortExplanationHebrew",
    "parts",
    "grammarPoints",
    "exampleJapanese",
    "exampleHiragana",
    "exampleRomaji",
    "exampleHebrew",
    "learningTipHebrew",
  ],
  additionalProperties: false,
};

const instructions = `You are a precise Japanese tutor for a 14-year-old Hebrew-speaking beginner who can read hiragana.

The input may be Hebrew or Japanese.

If the input is Hebrew:
- Translate it into natural, age-appropriate Japanese in correctedJapanese.
- Set sourceLanguage to hebrew.
- Set isNaturalJapanese to true because correctedJapanese is the natural Japanese result.
- Explain how the Japanese translation is constructed.

If the input is Japanese:
- Preserve the input in original.
- Correct it only when necessary and place the natural form in correctedJapanese.
- Set sourceLanguage to japanese.
- Set isNaturalJapanese according to whether the original Japanese was natural.

If the input is another language:
- Translate it into natural Japanese and set sourceLanguage to other.

For every input:
- Write all explanations and translations in clear, concise Hebrew.
- hiraganaReading must contain the complete Japanese reading in hiragana.
- romaji must use readable Hepburn-style romanization.
- Break correctedJapanese into meaningful words or grammatical units, not individual characters.
- Use no more than 8 items in parts.
- Use no more than 4 grammar points.
- Explain particles and endings briefly in functionHebrew.
- Keep every Hebrew explanation to one or two short sentences.
- hebrewTranslation must state the meaning of correctedJapanese in natural Hebrew.
- Provide one short Japanese example at a similar difficulty level.
- Avoid unnecessary linguistic jargon.
- If the meaning is ambiguous, mention the ambiguity briefly.`;

// POST /api/analyze — analyzes a Japanese/Hebrew word or sentence via AI Gateway.
export default async (req: Request) => {
  let requestBody: { text?: string };
  try {
    requestBody = await req.json();
  } catch {
    return Response.json({ error: "יש להזין מילה או משפט." }, { status: 400 });
  }

  const input = requestBody.text?.trim();

  if (!input) {
    return Response.json({ error: "יש להזין מילה או משפט." }, { status: 400 });
  }
  if (input.length > 300) {
    return Response.json(
      { error: "אפשר לנתח עד 300 תווים בכל פעם." },
      { status: 400 },
    );
  }

  const key = getApiKey();
  if (!key || !key.trim()) {
    return Response.json(
      {
        error: "חסר מפתח API",
        detail: "שירות ה-AI אינו זמין כרגע. נסו שוב מאוחר יותר.",
      },
      { status: 503 },
    );
  }

  const model = getModel();

  const payload = {
    model,
    instructions,
    input,
    reasoning: { effort: "minimal" },
    max_output_tokens: 1200,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "japanese_learning_analysis",
        strict: true,
        schema,
      },
    },
  };

  try {
    const response = await openAiFetch(
      "v1/responses",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      35000,
      req.signal,
    );

    const responseBody = await response.text();

    if (!response.ok) {
      return Response.json(
        { error: toUserMessage(response.status, responseBody) },
        { status: response.status },
      );
    }

    const root = JSON.parse(responseBody);

    if (root?.status === "incomplete") {
      return Response.json(
        { error: "הניתוח נעצר לפני שהושלם. נסו משפט קצר יותר." },
        { status: 502 },
      );
    }

    const content = getOutputText(root);
    if (!content || !content.trim()) {
      return Response.json(
        { error: "המודל לא החזיר תשובה שניתן להציג." },
        { status: 502 },
      );
    }

    // The model returns strict JSON matching the schema; return it verbatim.
    const structured = JSON.parse(content);
    return Response.json(structured);
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return Response.json(
        {
          error:
            "הניתוח עבר את מגבלת הזמן של 35 שניות. בדוק חיבור, Proxy או חיוב API ונסה שוב.",
        },
        { status: 504 },
      );
    }
    if (err instanceof SyntaxError) {
      return Response.json(
        { error: "התקבלה תשובה שלא ניתן היה לקרוא." },
        { status: 502 },
      );
    }
    return Response.json(
      { error: "השרת לא הצליח להתחבר ל־OpenAI. בדוק אינטרנט, Proxy או חומת אש." },
      { status: 502 },
    );
  }
};

export const config = {
  path: "/api/analyze",
  method: "POST",
};
