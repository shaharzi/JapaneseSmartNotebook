import { getApiKey, getModel } from "../lib/openai.mts";

// GET /api/status — reports whether an API key is available and which model is used.
export default async () => {
  const key = getApiKey();
  const keyConfigured = !!(key && key.trim());

  return Response.json({
    keyConfigured,
    model: getModel(),
  });
};

export const config = {
  path: "/api/status",
  method: "GET",
};
