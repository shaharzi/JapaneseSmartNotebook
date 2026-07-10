import type { Handler } from "@netlify/functions";
import { toUserMessage } from "./_shared/openaiErrors";
import { getOutputText } from "./_shared/responseParser";

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
    "sourceLanguage", "inputType", "original", "correctedJapanese",
    "isNaturalJapanese", "hiraganaReading", "romaji",
    "hebrewTranslation", "shortExplanationHebrew", "parts",
    "grammarPoints", "exampleJapanese", "exampleHiragana",
    "exampleRomaji", "exampleHebrew", "learningTipHebrew",
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

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  let input: string | undefined;
  try {
    const parsed = event.body ? JSON.parse(event.body) : {};
    input = typeof parsed.text === "string" ? parsed.text.trim() : undefined;
  } catch {
    return jsonResponse(400, { error: "יש להזין מילה או משפט." });
  }

  if (!input) {
    return jsonResponse(400, { error: "יש להזין מילה או משפט." });
  }

  if (input.length > 300) {
    return jsonResponse(400, { error: "אפשר לנתח עד 300 תווים בכל פעם." });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(503, {
      error: "חסר מפתח API",
      detail: "יש להגדיר את משתנה הסביבה OPENAI_API_KEY בהגדרות ה-deploy.",
    });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseBody = await response.text();

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: toUserMessage(response.status, responseBody),
      });
    }

    const root = JSON.parse(responseBody);

    if (root?.status === "incomplete") {
      return jsonResponse(502, { error: "הניתוח נעצר לפני שהושלם. נסו משפט קצר יותר." });
    }

    const content = getOutputText(root);
    if (!content) {
      return jsonResponse(502, { error: "המודל לא החזיר תשובה שניתן להציג." });
    }

    const structured = JSON.parse(content);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(structured),
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return jsonResponse(504, {
        error: "הניתוח עבר את מגבלת הזמן. בדוק חיבור, Proxy או חיוב API ונסה שוב.",
      });
    }

    if (err instanceof SyntaxError) {
      return jsonResponse(502, { error: "התקבלה תשובה שלא ניתן היה לקרוא." });
    }

    return jsonResponse(502, { error: "השרת לא הצליח להתחבר ל־OpenAI. בדוק אינטרנט, Proxy או חומת אש." });
  } finally {
    clearTimeout(timeout);
  }
};
