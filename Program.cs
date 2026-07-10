using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpClient("OpenAI", client =>
{
    client.BaseAddress = new Uri("https://api.openai.com/");
    client.Timeout = TimeSpan.FromSeconds(45);
});

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/status", () =>
{
    var keyConfigured = !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("OPENAI_API_KEY"));
    var model = Environment.GetEnvironmentVariable("OPENAI_MODEL");

    if (string.IsNullOrWhiteSpace(model))
        model = "gpt-5-mini";

    return Results.Ok(new
    {
        keyConfigured,
        model
    });
});

app.MapPost("/api/check", async (
    IHttpClientFactory httpClientFactory,
    CancellationToken cancellationToken) =>
{
    var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
    if (string.IsNullOrWhiteSpace(apiKey))
        return Results.Json(new { error = "לא נטען מפתח API." }, statusCode: 503);

    var model = Environment.GetEnvironmentVariable("OPENAI_MODEL");
    if (string.IsNullOrWhiteSpace(model))
        model = "gpt-5-mini";

    using var client = httpClientFactory.CreateClient("OpenAI");
    using var request = new HttpRequestMessage(
        HttpMethod.Get,
        $"v1/models/{Uri.EscapeDataString(model)}");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

    using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    timeoutCts.CancelAfter(TimeSpan.FromSeconds(15));

    try
    {
        using var response = await client.SendAsync(request, timeoutCts.Token);
        var body = await response.Content.ReadAsStringAsync(timeoutCts.Token);

        if (!response.IsSuccessStatusCode)
        {
            return Results.Json(
                new { error = OpenAiErrors.ToUserMessage(response.StatusCode, body) },
                statusCode: (int)response.StatusCode);
        }

        return Results.Ok(new { ok = true, model });
    }
    catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
    {
        return Results.Json(
            new { error = "בדיקת החיבור הסתיימה בחריגה מהזמן. ייתכן שחומת אש או Proxy חוסמים את api.openai.com." },
            statusCode: 504);
    }
    catch (HttpRequestException ex)
    {
        app.Logger.LogError(ex, "OpenAI connectivity check failed.");
        return Results.Json(
            new { error = "לא ניתן להתחבר ל־OpenAI. בדוק חיבור אינטרנט, Proxy או חומת אש." },
            statusCode: 502);
    }
});

app.MapPost("/api/analyze", async (
    AnalyzeRequest request,
    IHttpClientFactory httpClientFactory,
    CancellationToken cancellationToken) =>
{
    var input = request.Text?.Trim();

    if (string.IsNullOrWhiteSpace(input))
        return Results.BadRequest(new { error = "יש להזין מילה או משפט." });

    if (input.Length > 300)
        return Results.BadRequest(new { error = "אפשר לנתח עד 300 תווים בכל פעם." });

    var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
    if (string.IsNullOrWhiteSpace(apiKey))
    {
        return Results.Problem(
            title: "חסר מפתח API",
            detail: "יש להפעיל את האפליקציה באמצעות run.cmd ולהזין OpenAI API key.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var model = Environment.GetEnvironmentVariable("OPENAI_MODEL");
    if (string.IsNullOrWhiteSpace(model))
        model = "gpt-5-mini";

    var schema = new
    {
        type = "object",
        properties = new
        {
            sourceLanguage = new
            {
                type = "string",
                @enum = new[] { "hebrew", "japanese", "other" }
            },
            inputType = new
            {
                type = "string",
                @enum = new[] { "word", "sentence", "expression" }
            },
            original = new { type = "string" },
            correctedJapanese = new { type = "string" },
            isNaturalJapanese = new { type = "boolean" },
            hiraganaReading = new { type = "string" },
            romaji = new { type = "string" },
            hebrewTranslation = new { type = "string" },
            shortExplanationHebrew = new { type = "string" },
            parts = new
            {
                type = "array",
                items = new
                {
                    type = "object",
                    properties = new
                    {
                        japanese = new { type = "string" },
                        hiragana = new { type = "string" },
                        romaji = new { type = "string" },
                        meaningHebrew = new { type = "string" },
                        functionHebrew = new { type = "string" }
                    },
                    required = new[]
                    {
                        "japanese", "hiragana", "romaji",
                        "meaningHebrew", "functionHebrew"
                    },
                    additionalProperties = false
                }
            },
            grammarPoints = new
            {
                type = "array",
                items = new
                {
                    type = "object",
                    properties = new
                    {
                        form = new { type = "string" },
                        explanationHebrew = new { type = "string" }
                    },
                    required = new[] { "form", "explanationHebrew" },
                    additionalProperties = false
                }
            },
            exampleJapanese = new { type = "string" },
            exampleHiragana = new { type = "string" },
            exampleRomaji = new { type = "string" },
            exampleHebrew = new { type = "string" },
            learningTipHebrew = new { type = "string" }
        },
        required = new[]
        {
            "sourceLanguage", "inputType", "original", "correctedJapanese",
            "isNaturalJapanese", "hiraganaReading", "romaji",
            "hebrewTranslation", "shortExplanationHebrew", "parts",
            "grammarPoints", "exampleJapanese", "exampleHiragana",
            "exampleRomaji", "exampleHebrew", "learningTipHebrew"
        },
        additionalProperties = false
    };

    var instructions = """
You are a precise Japanese tutor for a 14-year-old Hebrew-speaking beginner who can read hiragana.

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
- If the meaning is ambiguous, mention the ambiguity briefly.
""";

    var payload = new
    {
        model,
        instructions,
        input,
        reasoning = new { effort = "minimal" },
        max_output_tokens = 1200,
        text = new
        {
            verbosity = "low",
            format = new
            {
                type = "json_schema",
                name = "japanese_learning_analysis",
                strict = true,
                schema
            }
        }
    };

    using var client = httpClientFactory.CreateClient("OpenAI");
    using var message = new HttpRequestMessage(HttpMethod.Post, "v1/responses");
    message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
    message.Content = new StringContent(
        JsonSerializer.Serialize(payload),
        Encoding.UTF8,
        "application/json");

    using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    timeoutCts.CancelAfter(TimeSpan.FromSeconds(35));

    try
    {
        app.Logger.LogInformation(
            "Starting Japanese analysis. Model: {Model}, InputLength: {InputLength}",
            model,
            input.Length);

        using var response = await client.SendAsync(message, timeoutCts.Token);
        var responseBody = await response.Content.ReadAsStringAsync(timeoutCts.Token);

        if (!response.IsSuccessStatusCode)
        {
            app.Logger.LogWarning(
                "OpenAI request failed. Status: {StatusCode}. RequestId: {RequestId}. Body: {Body}",
                response.StatusCode,
                response.Headers.TryGetValues("x-request-id", out var ids) ? ids.FirstOrDefault() : null,
                responseBody);

            return Results.Json(
                new { error = OpenAiErrors.ToUserMessage(response.StatusCode, responseBody) },
                statusCode: (int)response.StatusCode);
        }

        using var responseJson = JsonDocument.Parse(responseBody);
        var root = responseJson.RootElement;

        if (root.TryGetProperty("status", out var statusElement) &&
            statusElement.GetString() == "incomplete")
        {
            return Results.Json(
                new { error = "הניתוח נעצר לפני שהושלם. נסו משפט קצר יותר." },
                statusCode: 502);
        }

        var content = ResponseParser.GetOutputText(root);
        if (string.IsNullOrWhiteSpace(content))
        {
            return Results.Json(
                new { error = "המודל לא החזיר תשובה שניתן להציג." },
                statusCode: StatusCodes.Status502BadGateway);
        }

        using var structured = JsonDocument.Parse(content);

        app.Logger.LogInformation("Japanese analysis completed successfully.");

        return Results.Content(
            structured.RootElement.GetRawText(),
            "application/json",
            Encoding.UTF8);
    }
    catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
    {
        app.Logger.LogWarning("OpenAI analysis timed out.");
        return Results.Json(
            new
            {
                error = "הניתוח עבר את מגבלת הזמן של 35 שניות. בדוק חיבור, Proxy או חיוב API ונסה שוב."
            },
            statusCode: StatusCodes.Status504GatewayTimeout);
    }
    catch (HttpRequestException ex)
    {
        app.Logger.LogError(ex, "Failed to connect to OpenAI.");
        return Results.Json(
            new
            {
                error = "השרת לא הצליח להתחבר ל־OpenAI. בדוק אינטרנט, Proxy או חומת אש."
            },
            statusCode: StatusCodes.Status502BadGateway);
    }
    catch (JsonException ex)
    {
        app.Logger.LogError(ex, "Failed to parse OpenAI response.");
        return Results.Json(
            new { error = "התקבלה תשובה שלא ניתן היה לקרוא." },
            statusCode: StatusCodes.Status502BadGateway);
    }
});

app.MapFallbackToFile("index.html");
app.Run();

public sealed record AnalyzeRequest(string? Text);

public static class ResponseParser
{
    public static string? GetOutputText(JsonElement root)
    {
        if (root.TryGetProperty("output_text", out var outputText) &&
            outputText.ValueKind == JsonValueKind.String)
        {
            return outputText.GetString();
        }

        if (!root.TryGetProperty("output", out var output) ||
            output.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var item in output.EnumerateArray())
        {
            if (!item.TryGetProperty("content", out var content) ||
                content.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var part in content.EnumerateArray())
            {
                if (part.TryGetProperty("type", out var type) &&
                    type.GetString() == "output_text" &&
                    part.TryGetProperty("text", out var text) &&
                    text.ValueKind == JsonValueKind.String)
                {
                    return text.GetString();
                }
            }
        }

        return null;
    }
}

public static class OpenAiErrors
{
    public static string ToUserMessage(HttpStatusCode statusCode, string body)
    {
        string? code = null;
        string? message = null;

        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("error", out var error))
            {
                if (error.TryGetProperty("code", out var codeElement) &&
                    codeElement.ValueKind == JsonValueKind.String)
                {
                    code = codeElement.GetString();
                }

                if (error.TryGetProperty("message", out var messageElement) &&
                    messageElement.ValueKind == JsonValueKind.String)
                {
                    message = messageElement.GetString();
                }
            }
        }
        catch (JsonException)
        {
            // Ignore malformed error bodies and use a safe generic message.
        }

        if (statusCode == HttpStatusCode.Unauthorized)
            return "מפתח ה־API אינו תקין או בוטל.";

        if (statusCode == HttpStatusCode.Forbidden)
            return "למפתח אין הרשאה להשתמש במודל שנבחר.";

        if (statusCode == HttpStatusCode.NotFound)
            return "המודל שהוגדר אינו זמין לחשבון הזה.";

        if (statusCode == HttpStatusCode.TooManyRequests)
        {
            if (string.Equals(code, "insufficient_quota", StringComparison.OrdinalIgnoreCase) ||
                (message?.Contains("quota", StringComparison.OrdinalIgnoreCase) ?? false) ||
                (message?.Contains("billing", StringComparison.OrdinalIgnoreCase) ?? false))
            {
                return "אין יתרת API זמינה או שלא הוגדר חיוב ב־OpenAI Platform.";
            }

            return "התקבלה מגבלת שימוש זמנית. נסו שוב בעוד זמן קצר.";
        }

        if ((int)statusCode >= 500)
            return "שירות OpenAI החזיר שגיאה זמנית. נסו שוב בעוד זמן קצר.";

        return "הבקשה ל־OpenAI נכשלה. בדוק את הגדרות המפתח והחיוב.";
    }
}
