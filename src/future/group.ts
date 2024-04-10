import * as R from "ramda";
import { Future } from "./future";
import { FutureEvent } from "../synchronize";
import { Stream } from "../stream";
import { ExecutorState } from "../stream/state";

/**
 * Groups one or more futures for collective operations
 */
export class FutureGroup<T = any> {
  readonly futures: Array<Future<T>>;
  private readonly closedEvent: FutureEvent;

  constructor() {
    this.futures = [];
    this.closedEvent = new FutureEvent();
  }

  /**
   * Check if the group can accept more futures
   */
  get open() {
    return !this.closedEvent.isSet;
  }

  /**
   * Total number of futures that completed
   */
  get totalCompleted() {
    return this.futures.reduce((total, future) => total + (future.done ? 1 : 0), 0);
  }

  /**
   * Total number of futures that failed
   */
  get totalFailed() {
    return this.futures.reduce((total, future) => total + (future.error ? 1 : 0), 0);
  }

  /**
   * Total number of futures current executing
   */
  get totalRunning() {
    return this.futures.reduce((total, future) => total + (future.running ? 1 : 0), 0);
  }

  /**
   * Adds a future to the group
   * @param future
   */
  add(future: Future<T>) {
    this.futures.push(future);
  }

  /**
   * Marks the group as closed, indicating that all the necessary futures to monitor have been added
   */
  done() {
    this.closedEvent.set();
  }

  /**
   * Waits for all the futures in the group to complete
   */
  allCompleted(): Future<FutureGroup> {
    return this.closedEvent
      .wait()
      .thenApply(() => Future.collect(this.futures))
      .thenApply(() => this) as unknown as Future<FutureGroup>;
  }

  /**
   * Waits for all the futures to complete and collect the results in an array
   */
  collect() {
    return this.closedEvent.wait().thenApply(() => Future.collect(this.futures));
  }

  /**
   * Waits for the first future to complete
   */
  firstCompleted() {
    return this.asCompleted().future;
  }

  /**
   * Waits for the first future to fail
   */
  firstFailed() {
    return this.asFailed().future;
  }

  /**
   * Stream of all the futures that failed
   */
  asFailed() {
    const pendingPromises: Array<Promise<{ future?: Future<T>; index: number }>> = [];
    const lookup = { pendingPromises };
    const createPromises = R.once(() => {
      lookup.pendingPromises = this.futures.map((future, index) => {
        return future
          .run()
          .then(() => ({ index }))
          .catch(() => ({ future, index }));
      });
    });

    return this.streamPendingFutures(lookup, createPromises);
  }

  /**
   * Stream of all the futures that completed
   */
  asCompleted() {
    const pendingPromises: Array<Promise<{ future?: Future<T>; index: number }>> = [];
    const lookup = { pendingPromises };
    const createPromises = R.once(() => {
      lookup.pendingPromises = this.futures.map((future, index) => {
        return future
          .run()
          .then(() => ({ index, future }))
          .catch(() => ({ index }));
      });
    });

    return this.streamPendingFutures(lookup, createPromises);
  }

  /**
   * Stream of all the futures either completed or failed
   */
  asSettled() {
    const pendingPromises: Array<Promise<{ future?: Future<T>; index: number }>> = [];
    const lookup = { pendingPromises };
    const createPromises = R.once(() => {
      lookup.pendingPromises = this.futures.map((future, index) => {
        return future
          .run()
          .then(() => ({ index, future }))
          .catch(() => ({ index, future }));
      });
    });

    return this.streamPendingFutures(lookup, createPromises);
  }

  /**
   * Waits for all the futures to run and either complete or fail
   */
  allSettled(): Future<FutureGroup> {
    return this.closedEvent
      .wait()
      .thenApply(() => Future.collectSettled(this.futures))
      .thenApply(() => this) as unknown as Future<FutureGroup>;
  }

  /**
   * Cancels every running future that is in the group
   */
  cancel() {
    this.futures.forEach((future) => future.cancel());
  }

  private streamPendingFutures(
    lookup: { pendingPromises: Array<Promise<{ future?: Future<T>; index: number }>> },
    setup: () => void
  ) {
    return new Stream<{ future: Future<T> }>(() => {
      setup();

      if (!lookup.pendingPromises.length) {
        return new ExecutorState(true);
      }
      return this.closedEvent.wait().thenApply(() =>
        Promise.any(lookup.pendingPromises).then((result) => {
          lookup.pendingPromises = lookup.pendingPromises.filter((_, index) => index !== result.index);
          if (result.future) {
            return { future: result.future };
          }
          return undefined;
        })
      );
    });
  }
}
