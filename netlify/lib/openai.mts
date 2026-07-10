// Shared helpers for the Japanese analysis API functions.
// AI inference goes through Netlify AI Gateway: the runtime injects
// OPENAI_API_KEY and OPENAI_BASE_URL, so no key management is needed here.

const DEFAULT_MODEL = "gpt-5-mini";

export function getModel(): string {
  const model = Netlify.env.get("OPENAI_MODEL");
  return model && model.trim() ? model : DEFAULT_MODEL;
}

export function getApiKey(): string | undefined {
  return Netlify.env.get("OPENAI_API_KEY");
}

// OPENAI_BASE_URL is injected by AI Gateway (without a trailing /v1).
// Fall back to the public OpenAI host so the code also runs with a
// user-provided key outside the gateway.
export function getBaseUrl(): string {
  const base = Netlify.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com";
  return base.replace(/\/+$/, "");
}

export async function openAiFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener("abort", () => controller.abort());
  }
  try {
    return await fetch(`${getBaseUrl()}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Extract the text output from an OpenAI Responses API payload.
export function getOutputText(root: any): string | null {
  if (typeof root?.output_text === "string") return root.output_text;

  if (!Array.isArray(root?.output)) return null;

  for (const item of root.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return null;
}

// Map an OpenAI error response to a user-facing Hebrew message,
// mirroring the original server behaviour.
export function toUserMessage(status: number, body: string): string {
  let code: string | undefined;
  let message: string | undefined;

  try {
    const parsed = JSON.parse(body);
    if (parsed?.error) {
      if (typeof parsed.error.code === "string") code = parsed.error.code;
      if (typeof parsed.error.message === "string") message = parsed.error.message;
    }
  } catch {
    // Ignore malformed error bodies and use a safe generic message.
  }

  if (status === 401) return "מפתח ה־API אינו תקין או בוטל.";
  if (status === 403) return "למפתח אין הרשאה להשתמש במודל שנבחר.";
  if (status === 404) return "המודל שהוגדר אינו זמין לחשבון הזה.";

  if (status === 429) {
    const lower = (message ?? "").toLowerCase();
    if (
      code?.toLowerCase() === "insufficient_quota" ||
      lower.includes("quota") ||
      lower.includes("billing")
    ) {
      return "אין יתרת API זמינה או שלא הוגדר חיוב ב־OpenAI Platform.";
    }
    return "התקבלה מגבלת שימוש זמנית. נסו שוב בעוד זמן קצר.";
  }

  if (status >= 500) return "שירות OpenAI החזיר שגיאה זמנית. נסו שוב בעוד זמן קצר.";

  return "הבקשה ל־OpenAI נכשלה. בדוק את הגדרות המפתח והחיוב.";
}
