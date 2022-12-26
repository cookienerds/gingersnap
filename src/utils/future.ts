import FutureCancelled from "../errors/FutureCancelled";
import FutureError from "../errors/FutureError";
import { wait, WaitPeriod } from "./timer";
import TimeoutError from "../errors/TimeoutError";

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
  private readonly signal: AbortSignal;
  private fulfilled: boolean;

  constructor(executor: Executor<T>, signal?: AbortSignal) {
    const abortSignal = signal ?? new AbortController().signal;
    let done = false;
    let callback: (() => any) | undefined;

    super((resolve, reject) => {
      let rejected = false;
      let timeout: any;
      if (abortSignal.aborted) return reject(new FutureCancelled());
      abortSignal.addEventListener(
        "abort",
        () => {
          if (!rejected) timeout = setTimeout(() => reject(new FutureCancelled()), 1000);
        },
        { once: true }
      );
      const execute = () =>
        executor(
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
            clearTimeout(timeout);
            reject(reason);
          },
          abortSignal
        );

      if (!done) callback = execute;
      else void execute();
    });
    this.signal = abortSignal;
    this.fulfilled = false;
    this.cancel = this.cancel.bind(this);
    done = true;
    if (callback) callback();
  }

  get done() {
    return this.fulfilled;
  }

  public cancel() {
    this.signal.dispatchEvent(new CustomEvent("abort"));
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
    value: Promise<InferredFutureResult<K>> | Future<InferredFutureResult<K>> | K | Executor<InferredFutureResult<K>>
  ): Future<InferredFutureResult<K>> {
    if (value instanceof Promise)
      return new Future(
        (resolve, reject) => {
          value.then(resolve as any).catch((error) => {
            if (error instanceof FutureError) reject(error);
            reject(new FutureError(error));
          });
        },
        value instanceof Future ? value.signal : undefined
      );
    else if (value instanceof Function) return new Future<InferredFutureResult<K>>(value);
    else return new Future((resolve) => resolve(value as any));
  }

  public static waitFor<K>(value: Future<K>, timeout: WaitPeriod | number) {
    const timeableFuture = wait(timeout);
    return Future.of<K>((resolve, reject, signal) => {
      signal.onabort = () => {
        timeableFuture.cancel();
      };
      void Promise.race([timeableFuture, value]).then((v) => {
        if (value.done) {
          timeableFuture.cancel();
          resolve(v.value as any);
          return;
        }
        value.cancel();
        reject(new TimeoutError());
      });
    });
  }

  public static sleep(timeout: WaitPeriod | number) {
    return wait(timeout);
  }
}
