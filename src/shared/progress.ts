export class ProgressTracker {
  private startTime: number;
  private completedItems = 0;

  constructor(
    private readonly totalItems: number,
    private readonly label: string,
  ) {
    this.startTime = Date.now();
  }

  tick(itemLabel?: string): void {
    this.completedItems++;
    if (this.totalItems <= 0) return;
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = elapsed > 0 ? this.completedItems / elapsed : 0;
    const remaining = rate > 0 ? (this.totalItems - this.completedItems) / rate : 0;
    const pct = Math.round((this.completedItems / this.totalItems) * 100);

    const parts = [
      `[${this.completedItems}/${this.totalItems}]`,
      `${pct}%`,
      `elapsed: ${this.formatTime(elapsed)}`,
    ];

    if (this.completedItems < this.totalItems) {
      parts.push(`ETA: ${this.formatTime(remaining)}`);
    }

    if (itemLabel) parts.push(itemLabel);

    console.log(`  ${this.label}: ${parts.join(" | ")}`);
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }
}
