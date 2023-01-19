import { Future, FutureResult } from "../../../src/utils/future";
import FutureCancelled from "../../../src/errors/FutureCancelled";
import TimeoutError from "../../../src/errors/TimeoutError";

describe("Futures", function () {
  it("should fulfill successfully", async () => {
    const result = await Future.of(5)
      .thenApply((v) => v.value * 5)
      .thenApply((v) => v.value ** 2)
      .thenApply(async (v) => `Result is ${v.value}`)
      .thenApply((v) => {
        expect(v.signal).toBeDefined();
        throw new Error(v.value);
      })
      .catch((error: Error) => new FutureResult(error.message, undefined as any));
    expect(result).toEqual("Result is 625");
  });

  it("should cancel with error", async () => {
    const future = Future.sleep({ seconds: 5 }).thenApply(() => 5);

    void Future.sleep({ seconds: 1 })
      .thenApply(() => future.cancel())
      .schedule();

    await expect(future.run()).rejects.toEqual(new FutureCancelled());
  });

  it("should create future with executor", async () => {
    const result = await Future.of<number>((resolve) => resolve(5));
    expect(result).toEqual(5);
  });

  it("should wait for period", async () => {
    const future = Future.of<number>((resolve) => resolve(5));
    const currentTime = performance.now();
    await Future.waitFor(future, { seconds: 1 });
    expect(performance.now() - currentTime).toBeLessThan(1000);
  });

  it("should wait cancel before period", async () => {
    const future = Future.sleep({ seconds: 5 }).thenApply(() => 10);
    await expect(Future.waitFor(future, { seconds: 1 }).run()).rejects.toEqual(new TimeoutError());
  });
});
