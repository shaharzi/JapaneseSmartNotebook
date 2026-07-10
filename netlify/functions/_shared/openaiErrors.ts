export function toUserMessage(statusCode: number, body: string): string {
  let code: string | undefined;
  let message: string | undefined;

  try {
    const parsed = JSON.parse(body);
    code = parsed?.error?.code;
    message = parsed?.error?.message;
  } catch {
    // Ignore malformed error bodies and use a safe generic message.
  }

  if (statusCode === 401) return "מפתח ה־API אינו תקין או בוטל.";
  if (statusCode === 403) return "למפתח אין הרשאה להשתמש במודל שנבחר.";
  if (statusCode === 404) return "המודל שהוגדר אינו זמין לחשבון הזה.";

  if (statusCode === 429) {
    const lowerMessage = message?.toLowerCase() ?? "";
    if (
      code?.toLowerCase() === "insufficient_quota" ||
      lowerMessage.includes("quota") ||
      lowerMessage.includes("billing")
    ) {
      return "אין יתרת API זמינה או שלא הוגדר חיוב ב־OpenAI Platform.";
    }
    return "התקבלה מגבלת שימוש זמנית. נסו שוב בעוד זמן קצר.";
  }

  if (statusCode >= 500) return "שירות OpenAI החזיר שגיאה זמנית. נסו שוב בעוד זמן קצר.";

  return "הבקשה ל־OpenAI נכשלה. בדוק את הגדרות המפתח והחיוב.";
}
