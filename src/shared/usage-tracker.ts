interface UsageEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: string;
  workflow: string;
}

class UsageTracker {
  private entries: UsageEntry[] = [];

  record(
    model: string,
    inputTokens: number,
    outputTokens: number,
    workflow: string,
  ): void {
    this.entries.push({
      model,
      inputTokens,
      outputTokens,
      timestamp: new Date().toISOString(),
      workflow,
    });
  }

  getSummary(): {
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCostUsd: number;
    callCount: number;
  } {
    const totalInput = this.entries.reduce((sum, e) => sum + e.inputTokens, 0);
    const totalOutput = this.entries.reduce(
      (sum, e) => sum + e.outputTokens,
      0,
    );

    let cost = 0;
    for (const e of this.entries) {
      if (e.model.includes("sonnet")) {
        cost += (e.inputTokens * 3 + e.outputTokens * 15) / 1_000_000;
      } else if (e.model.includes("haiku")) {
        cost += (e.inputTokens * 0.25 + e.outputTokens * 1.25) / 1_000_000;
      }
    }

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      estimatedCostUsd: Math.round(cost * 10000) / 10000,
      callCount: this.entries.length,
    };
  }

  printSummary(): void {
    const s = this.getSummary();
    if (s.callCount === 0) return;
    console.log(
      `\nAPI Usage: ${s.callCount} calls, ${s.totalInputTokens} input + ${s.totalOutputTokens} output tokens, ~$${s.estimatedCostUsd}`,
    );
  }

  reset(): void {
    this.entries = [];
  }
}

export const usageTracker = new UsageTracker();
