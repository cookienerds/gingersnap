import FutureCancelled from "../errors/FutureCancelled";
import FutureError from "../errors/FutureError";
import { wait, WaitPeriod } from "./timer";
import TimeoutError from "../errors/TimeoutError";
import InvalidValue from "../errors/InvalidValue";
import * as R from "ramda";
import { clearTimeout } from "timers";
import { Stream } from "./stream";

type Resolve<T> = (value: T | PromiseLike<T>) => any;
type Reject = (reason?: FutureError) => void;
type Executor<T> = (resolve: Resolve<T>, reject: Reject, signal: AbortSignal) => void | Promise<void>;
type InferredFutureResult<T> = T extends FutureResult<infer U> ? U : T;

export class FutureResult<T> {
  readonly value: T;
  readonly signal: AbortSignal;

  constructor(value: T, signal: AbortSignal) {
    this.value = value;
    this.signal = signal;
  }
}

export class Future<T> extends Promise<FutureResult<T>> {
  private readonly signals: Set<AbortSignal>;

  private signalRegisteredCallback?: (v: AbortSignal) => void;

  private readonly defaultSignal: AbortSignal;

  private fulfilled: boolean;

  constructor(executor: Executor<T>, signal?: AbortSignal) {
    let done = false;
    let callback: (() => any) | undefined;

    super((resolve, reject) => {
      const execute = function (this: Future<T>) {
        let rejected = false;
        const timeouts: any[] = [];

        if (Array.from(this.signals).some((v) => v.aborted)) return reject(new FutureCancelled());
        const abortSignal = new AbortController().signal;
        const abort = R.once(() => this.cancelWithSignal(abortSignal));

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
        this.signalRegisteredCallback = (v) =>
          v.addEventListener(
            "abort",
            () => {
              abort();
              if (!rejected) timeouts.push(setTimeout(() => reject(new FutureCancelled()), 1000));
            },
            { once: true }
          );

        void executor(
          (v) => {
            if (v instanceof Promise)
              v.then((v) => {
                this.fulfilled = true;
                resolve(new FutureResult(v, abortSignal));
              }).catch(reject);
            else if (v instanceof FutureResult) {
              this.fulfilled = true;
              resolve(v);
            } else {
              this.fulfilled = true;
              resolve(new FutureResult(v as T, abortSignal));
            }
          },
          (reason) => {
            rejected = true;
            timeouts.forEach((v) => clearTimeout(v));
            reject(reason);
          },
          abortSignal
        );
      };

      if (!done) callback = execute;
      else void execute.bind(this)();
    });

    this.defaultSignal = signal ?? new AbortController().signal;
    this.signals = new Set<AbortSignal>([this.defaultSignal]);
    this.fulfilled = false;
    this.cancel = this.cancel.bind(this);
    done = true;
    if (callback) callback.bind(this)();
  }

  get done() {
    return this.fulfilled;
  }

  get stream() {
    return Stream.of(this);
  }

  public registerSignal(signal: AbortSignal) {
    this.signals.add(signal);
    if (this.signalRegisteredCallback) this.signalRegisteredCallback(signal);
  }

  public deregisterSignal(signal: AbortSignal) {
    if (signal === this.defaultSignal) throw new InvalidValue("Cannot deregister default signal");
    this.signals.delete(signal);
  }

  public cancel() {
    this.signals.forEach(this.cancelWithSignal);
  }

  private cancelWithSignal(signal: AbortSignal) {
    signal.dispatchEvent(new CustomEvent("abort"));
  }

  // @ts-expect-error
  catch<TResult = never>(
    onRejected?: ((reason: any) => PromiseLike<TResult> | TResult) | undefined | null
  ): Future<InferredFutureResult<T | TResult>> {
    return super.catch((error: any) => {
      if (!onRejected) {
        if (error instanceof FutureError) throw error;
        throw new FutureError(error);
      }

      let result = onRejected(error);
      if (result instanceof Promise) {
        return result
          .then((v) => {
            if (v instanceof FutureResult) v = v.value;
            return v as TResult | T;
          })
          .catch((error) => {
            if (error instanceof FutureError) throw error;
            throw new FutureError(error);
          });
      } else if (result instanceof FutureResult) {
        result = result.value;
      }
      return result as TResult | T;
    }) as Future<InferredFutureResult<T | TResult>>;
  }

  // @ts-expect-error
  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: FutureResult<T>) => PromiseLike<TResult1> | TResult1) | undefined | null,
    onRejected?: ((reason: any) => PromiseLike<TResult2> | TResult2) | undefined | null
  ): Future<InferredFutureResult<TResult1 | TResult2>> {
    return super.then(onFulfilled, onRejected) as unknown as Future<InferredFutureResult<TResult1 | TResult2>>;
  }

  public static of<K>(
    value: Promise<InferredFutureResult<K>> | Future<InferredFutureResult<K>> | K | Executor<InferredFutureResult<K>>,
    signal?: AbortSignal
  ): Future<InferredFutureResult<K>> {
    if (value instanceof Promise)
      return new Future((resolve, reject) => {
        value.then(resolve as any).catch((error) => {
          if (error instanceof FutureError) reject(error);
          reject(new FutureError(error));
        });
      }, signal ?? (value instanceof Future ? value.defaultSignal : undefined));
    else if (value instanceof Function) return new Future<InferredFutureResult<K>>(value);
    else return new Future((resolve) => resolve(value as any));
  }

  public static waitFor<K>(value: Future<K>, timeout: WaitPeriod | number) {
    const timeableFuture = wait(timeout);
    return Future.of<K>((resolve, reject, signal) => {
      timeableFuture.registerSignal(signal);
      void Promise.race([timeableFuture, value]).then((v) => {
        if (value.done) {
          timeableFuture.cancel();
          resolve(v.value as any);
          return;
        }
        value.cancel();
        reject(new TimeoutError());
      });
    }, value.defaultSignal);
  }

  public static sleep(timeout: WaitPeriod | number) {
    return wait(timeout);
  }
}
