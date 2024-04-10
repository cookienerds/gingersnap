import { Future, FutureGroup, FutureResult } from "../../../src/future";
import { FutureCancelled, TimeoutError, FutureError } from "../../../src/errors";
import { Collectors } from "../../../src/stream/collector";

describe("Futures", function () {
  it("should fulfill successfully", async () => {
    const future = Future.completed(5)
      .thenApply((v) => v.value * 5)
      .thenApply((v) => v.value ** 2)
      .thenApply(async (v) => `Result is ${v.value}`)
      .thenApply((v) => {
        expect(v.signal).toBeDefined();
        throw new Error(v.value);
      })
      .catch((error: Error) => new FutureResult(error.message, undefined as any));
    const result = await future;
    const result2 = await future;
    expect(result).toEqual("Result is 625");
    expect(result).toEqual(result2);
  });

  it("should cancel with error", async () => {
    const future = Future.sleep({ seconds: 5 }).thenApply(() => 5);

    Future.sleep({ seconds: 1 })
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

  it("should fail when waiting for future", async () => {
    const future = Future.exceptionally(new FutureError());
    await expect(Future.waitFor(future, { seconds: 1 }).run()).rejects.toEqual(new FutureError());
  });

  it("should wait cancel before period", async () => {
    const future = Future.sleep({ seconds: 5 }).thenApply(() => 10);
    await expect(Future.waitFor(future, { seconds: 1 }).run()).rejects.toEqual(new TimeoutError());
  });

  it("should wrap promise", async () => {
    const future = Future.wrap(Promise.resolve(5)).thenApply((v) => v.value * 10);
    expect(await future).toEqual(50);
  });

  it("should return immediately for completed values", async () => {
    const future = Future.completed(5).thenApply((v) => v.value * 10);
    expect(await future).toEqual(50);
  });

  it("should fail immediately for exceptionally values", async () => {
    const future = Future.exceptionally(new FutureError()).thenApply((v) => v.value);
    await expect(future.run()).rejects.toEqual(new FutureError());
  });

  it("should return first completed", async () => {
    const future = Future.firstCompleted([Future.completed(5), Future.sleep(1).thenApply(() => 10)]).thenApply(
      (v) => v.value * 10
    );
    expect(await future).toEqual(50);
  });

  it("should collect all future results", async () => {
    const future = Future.collect([Future.completed(5), Future.sleep(1).thenApply(() => 10)]);
    expect(await future).toEqual([5, 10]);
  });

  it("should collect all future that have settled", async () => {
    const futures = [Future.completed(5), Future.exceptionally(new FutureError())];
    const result = await Future.collectSettled(futures);
    expect(result).toEqual(futures);
    expect(result[0].done).toBeTruthy();
    expect(result[0].failed).toBeFalsy();
    expect(result[0].result).toEqual(5);
    expect(result[0].error).toEqual(undefined);
    expect(result[1].done).toBeFalsy();
    expect(result[1].failed).toBeTruthy();
    expect(result[1].error).toEqual(new FutureError());
  });

  it("should group futures", async () => {
    const group = new FutureGroup<number>();
    group.add(Future.completed(5));
    group.add(Future.completed(10));

    expect(group.open).toBeTruthy();

    group.done();

    expect(group.open).toBeFalsy();
    expect((await group.firstCompleted()).future.result).toEqual(5);
    expect(await group.collect()).toEqual([5, 10]);
    expect(group.totalRunning).toEqual(0);
    expect(group.totalFailed).toEqual(0);
    expect(group.totalCompleted).toEqual(2);
  });

  it("should group futures and wait for all to complete", async () => {
    const group = new FutureGroup<number>();
    group.add(Future.completed(5));
    group.add(Future.sleep(2).thenApply(() => 10));
    group.done();
    await group.allCompleted();
    expect(group.futures.map((fut) => fut.result)).toEqual([5, 10]);
  });

  it("should group futures fail on awaiting all completion", async () => {
    const future = Future.exceptionally(new FutureError()) as any;
    const group = new FutureGroup<number>();
    group.add(Future.completed(5));
    group.add(future);
    group.done();
    await expect(group.allCompleted().run()).rejects.toEqual(new FutureError());
    expect((await group.firstFailed()).future).toEqual(future);
  });

  it("should await all settled futures in a group", async () => {
    const future: any = Future.sleep(2).thenApply(() => Future.exceptionally(new FutureError()));
    const future2 = Future.sleep(3).thenApply(() => Future.completed(5));
    const group = new FutureGroup<number>();
    group.add(future2);
    group.add(future);
    group.done();
    expect(await group.asSettled().execute()).toEqual({ future });
    expect(await group.asSettled().collect(Collectors.asList())).toEqual([{ future }, { future: future2 }]);
  });
});
