export class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private readonly concurrency: number) {
    if (concurrency < 1) {
      throw new RangeError(`Semaphore concurrency must be >= 1, got ${concurrency}`);
    }
  }

  async acquire(): Promise<void> {
    if (this.running < this.concurrency) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}
