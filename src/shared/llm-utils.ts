import Anthropic from "@anthropic-ai/sdk";

let clientInstance: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic();
  }
  return clientInstance;
}

export function parseJsonFromResponse(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/m, "");
  cleaned = cleaned.replace(/\s*```\s*$/m, "");
  cleaned = cleaned.trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found in response");
  }
  return JSON.parse(match[0]) as unknown;
}

export function parseJsonArrayFromResponse(text: string): unknown[] {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/m, "");
  cleaned = cleaned.replace(/\s*```\s*$/m, "");
  cleaned = cleaned.trim();

  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return [];
  }
  const parsed: unknown = JSON.parse(match[0]);
  return Array.isArray(parsed) ? parsed : [];
}
