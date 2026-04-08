import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming, Message } from "@anthropic-ai/sdk/resources/messages.js";
import { usageTracker } from "./usage-tracker.js";

export interface LlmClient {
  createMessage(
    params: MessageCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<Message>;
}

let clientFactory: () => LlmClient = () => {
  const anthropic = new Anthropic();
  return {
    createMessage: (params, options) =>
      anthropic.messages.create(params, options),
  };
};

export function setClientFactory(factory: () => LlmClient): void {
  clientFactory = factory;
}

export function getClient(): LlmClient {
  return clientFactory();
}

interface CallOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  workflow?: string;
}

const DEFAULT_OPTIONS: Required<CallOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 120000,
  workflow: "unknown",
};

const RETRYABLE_STATUS_CODES = new Set([429, 500, 503, 529]);

export async function callLlm(
  params: MessageCreateParamsNonStreaming,
  opts?: CallOptions,
): Promise<Message> {
  const { maxRetries, baseDelayMs, maxDelayMs, timeoutMs, workflow } = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };
  const client = getClient();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await client.createMessage(params, {
        signal: controller.signal,
      });

      usageTracker.record(
        params.model,
        response.usage.input_tokens,
        response.usage.output_tokens,
        workflow,
      );

      return response;
    } catch (error) {
      const isRetryable =
        error instanceof Anthropic.APIError &&
        RETRYABLE_STATUS_CODES.has(error.status);
      const isTimeout =
        error instanceof DOMException && error.name === "AbortError";

      if ((isRetryable || isTimeout) && attempt < maxRetries) {
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt),
          maxDelayMs,
        );
        const jitter = delay * (0.5 + Math.random() * 0.5);
        console.log(
          `  API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(jitter)}ms...`,
        );
        await sleep(jitter);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Unreachable");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
