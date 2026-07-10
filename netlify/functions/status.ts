import type { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  const keyConfigured = !!process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ keyConfigured, model }),
  };
};
