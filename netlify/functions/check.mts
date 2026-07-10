import { getApiKey, getModel, openAiFetch, toUserMessage } from "../lib/openai.mts";

// POST /api/check — verifies that the API key and model actually work by
// issuing a tiny inference request through AI Gateway.
export default async (req: Request) => {
  const key = getApiKey();
  if (!key || !key.trim()) {
    return Response.json({ error: "לא נטען מפתח API." }, { status: 503 });
  }

  const model = getModel();

  const payload = {
    model,
    input: "ping",
    reasoning: { effort: "minimal" },
    max_output_tokens: 16,
  };

  try {
    const response = await openAiFetch(
      "v1/responses",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      15000,
      req.signal,
    );

    const body = await response.text();

    if (!response.ok) {
      return Response.json(
        { error: toUserMessage(response.status, body) },
        { status: response.status },
      );
    }

    return Response.json({ ok: true, model });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return Response.json(
        {
          error:
            "בדיקת החיבור הסתיימה בחריגה מהזמן. ייתכן שחומת אש או Proxy חוסמים את השירות.",
        },
        { status: 504 },
      );
    }
    return Response.json(
      { error: "לא ניתן להתחבר ל־OpenAI. בדוק חיבור אינטרנט, Proxy או חומת אש." },
      { status: 502 },
    );
  }
};

export const config = {
  path: "/api/check",
  method: "POST",
};
