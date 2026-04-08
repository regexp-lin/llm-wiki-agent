const ESTIMATED_CHARS_PER_TOKEN = 4;

export interface ContextBudget {
  maxTotalTokens: number;
  reservedForOutput: number;
  reservedForPromptFrame: number;
}

const DEFAULT_BUDGET: ContextBudget = {
  maxTotalTokens: 180000,
  reservedForOutput: 4096,
  reservedForPromptFrame: 2000,
};

export function fitPagesIntoBudget(
  pages: { path: string; content: string }[],
  budget: ContextBudget = DEFAULT_BUDGET,
): { path: string; content: string; truncated: boolean }[] {
  const availableTokens =
    budget.maxTotalTokens - budget.reservedForOutput - budget.reservedForPromptFrame;
  const maxChars = availableTokens * ESTIMATED_CHARS_PER_TOKEN;

  let usedChars = 0;
  const result: { path: string; content: string; truncated: boolean }[] = [];

  for (const page of pages) {
    const remaining = maxChars - usedChars;
    if (remaining <= 0) break;

    if (page.content.length <= remaining) {
      result.push({ ...page, truncated: false });
      usedChars += page.content.length;
    } else {
      const truncated = truncateAtParagraph(page.content, remaining);
      result.push({
        path: page.path,
        content: truncated + "\n\n[...truncated]",
        truncated: true,
      });
      usedChars += truncated.length;
    }
  }

  return result;
}

function truncateAtParagraph(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastParagraph = truncated.lastIndexOf("\n\n");
  if (lastParagraph > maxChars * 0.5) {
    return truncated.slice(0, lastParagraph);
  }
  return truncated;
}
