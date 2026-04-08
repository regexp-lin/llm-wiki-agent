import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Semaphore } from "./semaphore.js";

describe("Semaphore", () => {
  it("allows up to concurrency limit", async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();
    let thirdAcquired = false;
    const p = sem.acquire().then(() => {
      thirdAcquired = true;
    });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(thirdAcquired, false);
    sem.release();
    await p;
    assert.equal(thirdAcquired, true);
    sem.release();
    sem.release();
  });

  it("handles single concurrency", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    await sem.acquire();
    const p1 = sem.acquire().then(() => {
      order.push(1);
      sem.release();
    });
    const p2 = sem.acquire().then(() => {
      order.push(2);
      sem.release();
    });

    sem.release();
    await p1;
    await p2;

    assert.deepEqual(order, [1, 2]);
  });
});
