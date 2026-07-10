export function getOutputText(root: any): string | null {
  if (typeof root?.output_text === "string") {
    return root.output_text;
  }

  if (!Array.isArray(root?.output)) {
    return null;
  }

  for (const item of root.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        return part.text;
      }
    }
  }

  return null;
}
