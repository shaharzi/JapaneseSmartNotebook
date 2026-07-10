import type { Handler } from "@netlify/functions";
import { toUserMessage } from "./_shared/openaiErrors";

export const handler: Handler = async () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "לא נטען מפתח API." }),
    };
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      }
    );
    const body = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: toUserMessage(response.status, body) }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, model }),
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return {
        statusCode: 504,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error:
            "בדיקת החיבור הסתיימה בחריגה מהזמן. ייתכן שחומת אש או Proxy חוסמים את api.openai.com.",
        }),
      };
    }

    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        error: "לא ניתן להתחבר ל־OpenAI. בדוק חיבור אינטרנט, Proxy או חומת אש.",
      }),
    };
  } finally {
    clearTimeout(timeout);
  }
};
