import FutureCancelled from "../errors/FutureCancelled";
import FutureError from "../errors/FutureError";
import TimeoutError from "../errors/TimeoutError";
import InvalidValue from "../errors/InvalidValue";
import * as R from "ramda";
import { clearTimeout } from "timers";
import { Stream } from "./stream";
import { SimpleQueue } from "../data-structures/object/SimpleQueue";
import { InferStreamResult } from "./types";

type Resolve<T> = (value: T | PromiseLike<T>) => any;
type Reject = (reason?: FutureError) => void;
type Executor<T> = (resolve: Resolve<T>, reject: Reject, signal: AbortSignal) => void | Promise<void>;
type InferredFutureResult<T> = T extends FutureResult<infer U>
  ? InferredFutureResult<U>
  : T extends Promise<infer U>
  ? InferredFutureResult<U>
  : T;

export class FutureResult<T> {
  readonly value: T;
  readonly signal: AbortSignal;

  constructor(value: T, signal: AbortSignal) {
    this.value = value;
    this.signal = signal;
  }
}

export interface WaitPeriod {
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
  hours?: number;
}

export class Future<T> {
  private signals: Set<AbortSignal>;

  private signalRegisteredCallback?: (v: AbortSignal) => void;

  private defaultSignal: AbortSignal;

  private fulfilled: boolean;

  private isRunning: boolean;

  private readonly executor: Executor<T>;

  private completedResult?: T;

  private failureResult?: Error;

  private underLyingPromise?: Promise<T>;

  private processors: SimpleQueue<{ success?: (v: FutureResult<T>) => any; failure?: (v: Error) => any }>;

  constructor(executor: Executor<T>, signal?: AbortSignal) {
    this.executor = executor;
    this.defaultSignal = signal ?? new AbortController().signal;
    this.signals = new Set<AbortSignal>([this.defaultSignal]);
    this.fulfilled = false;
    this.isRunning = false;
    this.processors = new SimpleQueue();
  }

  public static of<K>(
    value: Promise<InferredFutureResult<K>> | Future<InferredFutureResult<K>> | K | Executor<InferredFutureResult<K>>,
    signal?: AbortSignal
  ): Future<InferredFutureResult<K>> {
    if (value instanceof Promise) {
      return new Future((resolve, reject) => {
        value.then(resolve as any).catch((error) => {
          if (error instanceof FutureError) reject(error);
          reject(new FutureError(error));
        });
      }, signal);
    } else if (value instanceof Future) {
      return value;
    } else if (value instanceof Function) {
      return new Future<InferredFutureResult<K>>(value);
    } else {
      return Future.completed(value) as Future<InferredFutureResult<K>>;
    }
  }

  public static waitFor<K>(value: Future<K> | Promise<K>, timeout: WaitPeriod | number) {
    let futureValue: Future<K>;
    if (value instanceof Promise) {
      futureValue = Future.of(value as any) as Future<K>;
    } else {
      futureValue = value;
    }

    const timeableFuture = Future.sleep(timeout).catch(() => {});
    return Future.of<K>((resolve, reject, signal) => {
      timeableFuture.registerSignal(signal);
      Promise.race([timeableFuture, futureValue.run()])
        .then((v) => {
          if (futureValue.done) {
            timeableFuture.cancel();
            resolve(v as any);
            return;
          }
          futureValue.cancel();
          reject(new TimeoutError());
        })
        .catch((error) => {
          if (!timeableFuture.failed) {
            timeableFuture.cancel();
          }
          reject(error);
        });
    }, futureValue.defaultSignal);
  }

  public static sleep(period: WaitPeriod | number, signal?: AbortSignal) {
    return new Future<void>((resolve, reject, futureSignal) => {
      const totalTime =
        typeof period === "number"
          ? period * 1000
          : (period.hours ?? 0) * 60 * 60 * 1000 +
            (period.minutes ?? 0) * 60 * 1000 +
            (period.seconds ?? 0) * 1000 +
            (period.milliseconds ?? 0);
      const timer = setTimeout(resolve, totalTime);
      futureSignal.onabort = () => {
        clearTimeout(timer);
        reject(new FutureCancelled());
      };
    }, signal);
  }

  public static completed<T>(value: T) {
    if (value instanceof FutureResult) {
      return new Future<T>((resolve) => resolve(value.value));
    }
    return new Future<T>((resolve) => resolve(value));
  }

  get done() {
    return this.fulfilled;
  }

  get failed() {
    return this.error instanceof Error;
  }

  get result() {
    return this.completedResult;
  }

  get running() {
    return this.isRunning;
  }

  get error() {
    return this.failureResult;
  }

  get stream(): Stream<InferStreamResult<T>> {
    return Stream.of(this) as Stream<InferStreamResult<T>>;
  }

  public schedule() {
    void this.run();
    return this;
  }

  public run() {
    return this.__run__();
  }

  public registerSignal(signal: AbortSignal) {
    if (!this.done && !this.failed) {
      this.signals.add(signal);
      if (this.signalRegisteredCallback) this.signalRegisteredCallback(signal);
    }
  }

  public unregisterSignal(signal: AbortSignal) {
    if (signal === this.defaultSignal) throw new InvalidValue("Cannot deregister default signal");
    this.signals.delete(signal);
  }

  public cancel() {
    if (!this.done && !this.failed) {
      this.cancelWithSignal(this.defaultSignal);
    }
  }

  thenApply<K>(callback: (value: FutureResult<T>) => K): Future<InferredFutureResult<K>> {
    const newFuture = this.clone() as Future<InferredFutureResult<K>>;
    newFuture.processors.enqueue({ success: callback as any });
    return newFuture;
  }

  catch<K>(callback: (reason: Error) => K): Future<InferredFutureResult<T | K>> {
    const newFuture = this.clone() as Future<InferredFutureResult<K>>;
    newFuture.processors.enqueue({ failure: callback });
    return newFuture as unknown as Future<InferredFutureResult<T | K>>;
  }

  /**
   * Internal. Only to be called by the internal JS runtime during await
   * @private
   */
  private then(onFulfilled: (v: T) => void, onRejected: (reason: unknown) => void) {
    return this.__run__(onFulfilled, onRejected);
  }

  private __run__(onFulfilled?: (v: T) => void, onRejected?: (reason: unknown) => void): Promise<T> {
    if (this.underLyingPromise) {
      return this.underLyingPromise
        .then((v) => {
          onFulfilled?.(v);
          return v;
        })
        .catch((error) => {
          if (!(error instanceof Error)) {
            error = new FutureError(error);
          }
          onRejected?.(error);
          throw error;
        });
    }

    this.isRunning = true;
    const resolvePromise: (v: Promise<T>) => Promise<any> = (promise: Promise<T>) => {
      return promise
        .then(async (result) => {
          while (!this.processors.empty) {
            const { success } = this.processors.dequeue()!;
            if (!success) continue;

            try {
              result = await this.postResultProcessing(success(new FutureResult(result, this.defaultSignal)));
            } catch (error: unknown) {
              const handler = this.findFailureHandler();
              if (!handler) throw new FutureError(String(error));
              result = await this.postResultProcessing(
                handler(error instanceof Error ? error : new Error(String(error)))
              );
            }
          }
          return result;
        })
        .then((v) => {
          onFulfilled?.(v);
          return v;
        })
        .catch(async (error) => {
          const handler = this.findFailureHandler();
          if (!handler) {
            if (!(error instanceof Error)) {
              error = new FutureError(error);
            }
            onRejected?.(error);
            throw error;
          }

          try {
            const result = await this.postResultProcessing(handler(error));
            return await resolvePromise(Promise.resolve(result));
          } catch (e) {
            onRejected?.(e);
            throw e;
          }
        });
    };
    this.underLyingPromise = resolvePromise(
      new Promise<T>((resolve, reject) => {
        if (Array.from(this.signals).some((v) => v.aborted)) {
          reject(new FutureCancelled());
          return;
        }

        let rejected = false;
        const timeouts: any[] = [];
        const abort = R.once(() => this.cancelWithSignal(this.defaultSignal));
        const resolver = (v: any) => {
          if (v instanceof Promise) {
            v.then((v) => {
              this.fulfilled = true;
              resolve(v);
            }).catch(reject);
          } else if (v instanceof Future) {
            v.run()
              .then((v) => {
                this.fulfilled = true;
                resolve(v);
              })
              .catch(reject);
          } else if (v instanceof FutureResult) {
            this.fulfilled = true;
            resolve(v.value);
          } else {
            this.fulfilled = true;
            resolve(v);
          }
        };
        const rejecter = (reason: unknown) => {
          rejected = true;
          timeouts.forEach((v) => clearTimeout(v));
          reject(reason);
        };

        this.signalRegisteredCallback = (v) =>
          v.addEventListener(
            "abort",
            () => {
              abort();
              if (!rejected) timeouts.push(setTimeout(() => reject(new FutureCancelled()), 1000));
            },
            { once: true }
          );
        this.signals.forEach((v) => {
          v.addEventListener(
            "abort",
            () => {
              abort();
              if (!rejected) timeouts.push(setTimeout(() => reject(new FutureCancelled()), 1000));
            },
            { once: true }
          );
        });

        void this.executor(resolver, rejecter, this.defaultSignal);
      })
    )
      .then((v) => {
        this.completedResult = v;
        return v;
      })
      .catch((e) => {
        this.failureResult = e instanceof Error ? e : new Error(String(e));
        throw e;
      })
      .finally(() => {
        this.signals = new Set();
        this.isRunning = false;
      });

    return this.underLyingPromise;
  }

  private cancelWithSignal(signal: AbortSignal) {
    if (!signal.aborted) {
      signal.dispatchEvent(new CustomEvent("abort"));
    }
  }

  private findFailureHandler() {
    while (!this.processors.empty) {
      const { failure } = this.processors.dequeue()!;
      if (failure) return failure;
    }
  }

  private async postResultProcessing(result: any) {
    if (result instanceof FutureResult) {
      result = result.value;
    } else if (result instanceof Future) {
      result.registerSignal(this.defaultSignal);
      result = await result.run();
    } else if (result instanceof Promise) {
      result = await result;
    }

    return result;
  }

  public clone(): Future<T> {
    const future = new Future(this.executor, this.defaultSignal);
    future.signals = new Set(this.signals);
    future.defaultSignal = this.defaultSignal;
    future.processors = this.processors.clone();
    future.fulfilled = this.fulfilled;
    return future;
  }
}
