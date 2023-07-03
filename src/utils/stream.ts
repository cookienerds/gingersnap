import CallExecutionError from "../errors/CallExecutionError";
import StreamEnded from "../errors/StreamEnded";
import * as R from "ramda";
import { AnyDataType, Flattened, InferErrorResult, InferStreamResult } from "./types";
import { Future, FutureResult, WaitPeriod } from "./future";
import { ExecutorState } from "./state";
import FutureError from "../errors/FutureError";

enum ActionType {
  TRANSFORM,
  FILTER,
  LIMIT,
  UNPACK,
  PACK,
  CATCH,
}

export enum State {
  MATCHED,
  CONTINUE,
  DONE,
}

interface LimitResult<T> {
  value?: T;
  done: boolean;
}
type ActionFunctor<T> = (v: T) => T | null | Promise<T> | LimitResult<T> | Promise<LimitResult<T>> | Stream<T>;
export type Executor = (v: AbortSignal) => Promise<any> | Future<any> | AnyDataType | ExecutorState<any> | Stream<any>;

/**
 * Handles a continuous supply of data that can be transformed and manipulated using a chain of actions
 */
export class Stream<T> implements AsyncGenerator<T> {
  protected executed: boolean;

  protected actions: Array<{ type: ActionType; functor: ActionFunctor<T> }>;

  protected done: boolean;

  protected backlog: Array<{ records: T[] | Stream<T>; actionIndex: number }>;

  private canRunExecutor: boolean;

  /**
   * AbortController used to cancel http request created by the callback
   * @private
   */
  private readonly controller: AbortController;

  /**
   * Callback function that executes a network request. Function should accept an AbortSignal as argument,
   * and return AnyDataType upon completion
   * @private
   */
  protected executor: Executor;

  constructor(executor: Executor) {
    this.executor = executor;
    this.controller = new AbortController();
    this.executed = false;
    this.done = false;
    this.canRunExecutor = true;
    this.actions = [];
    this.backlog = [];
  }

  /**
   * Streams the next available result from a list of futures, until all future completes. If any future fails, then the
   * stream will throw an error
   * @param futures
   */
  public static asCompleted(futures: Array<Future<any>>) {
    const registerSignal = R.once((signal: AbortSignal) => {
      futures.forEach((future) => {
        future.registerSignal(signal);
      });
    });
    const launchFutures = R.once((futures: Array<Future<any>>) => {
      const result = new Set<Future<[any, Future<any>]>>();
      for (let i = 0; i < futures.length; i++) {
        const future = futures[i].clone();
        result.add(future.thenApply((v) => [v.value, future], false));
      }
      return result;
    });

    return new Stream(async (signal) => {
      registerSignal(signal);
      const promises = launchFutures(futures);
      if (promises.size > 0) {
        const result: [any, Future<any>] = await Promise.race(promises as any);
        const [value, future] = result;
        promises.delete(future);
        return value;
      }
      return new ExecutorState(true);
    });
  }

  /**
   * Stream the next available result from the list of streams. If any stream fails, then this merged stream also fails.
   * @param streams
   */
  public static merge<K extends Array<Stream<any>>>(streams: K): Stream<InferStreamResult<K[number]>> {
    const register = R.once((signal: AbortSignal) => {
      signal.onabort = () => streams.forEach((stream) => stream.cancel());
    });
    const buildFuture = (stream: Stream<any>, index: number) =>
      stream.future
        .thenApply((v) => [v.value, index] as [any, number])
        .catch((error) => {
          if (error instanceof StreamEnded) {
            return [undefined, index] as [any, number];
          }
          throw error;
        });

    let streamCount = streams.length;
    const futures = streams.map((stream, index) => buildFuture(stream, index));

    return new Stream<InferStreamResult<K[number]>>(async (signal) => {
      register(signal);
      while (streamCount > 0) {
        const [value, index] = await Future.firstCompleted(futures);
        if (value === undefined) {
          futures[index] = new Future(() => {});
          streamCount--;
        } else {
          futures[index] = buildFuture(streams[index], index);
          return value;
        }
      }
      return new ExecutorState(true);
    });
  }

  /**
   * Aggregates the results from multiple streams
   * @param streams
   */
  public static zip<K extends Array<Stream<any>>>(streams: K): Stream<Array<InferStreamResult<K[number]>>> {
    const register = R.once(
      (signal: AbortSignal) => (signal.onabort = () => streams.forEach((stream) => stream.cancel()))
    );

    return new Stream<Array<InferStreamResult<K[0]>>>(async (signal) => {
      register(signal);
      try {
        return await Future.collect(streams.map((stream) => stream.future));
      } catch (error) {
        if (error instanceof StreamEnded) {
          return new ExecutorState(true);
        }
        throw error;
      }
    });
  }

  /**
   * Stream that never gives a result
   */
  static forever() {
    return new Stream<null>(() => {});
  }

  /**
   * Converts the provided value to a stream
   * @param value
   */
  static of<K>(value: Iterable<K> | AsyncGenerator<K> | AsyncGeneratorFunction | Future<K>): Stream<K> {
    if (value[Symbol.iterator]) {
      const iterator = value[Symbol.iterator]();
      return new Stream<K>((signal) => {
        if (!signal.aborted) {
          const { value, done } = iterator.next();
          return new ExecutorState(done, value);
        }
      });
    } else if (value instanceof Future) {
      let completed = false;
      return new Stream<K>(async (signal) => {
        value.registerSignal(signal);
        if (completed) {
          return new ExecutorState(true);
        }
        completed = true;
        return new ExecutorState(false, await value) as any;
      });
    }

    const iterator = value instanceof Function ? value() : value[Symbol.asyncIterator]();
    return new Stream<K>(async (signal) => {
      if (!signal.aborted) {
        const { value, done } = await iterator.next();
        return new ExecutorState(done, value) as any;
      }
    });
  }

  /**
   * Gets a future of the next value on the stream, if any.
   */
  get future(): Future<T> {
    return Future.of<T>((resolve, reject, signal) => {
      if (!signal.aborted) {
        signal.onabort = () => this.cancel();
        this.next()
          .then((v) => {
            if (v.done && v.value === undefined) {
              reject(new StreamEnded());
            } else {
              resolve(v.value);
            }
          })
          .catch(reject);
      }
    });
  }

  /**
   * Transforms each data on the stream using the callback provided
   * @param callback
   */
  map<K>(callback: (v: T) => K | Promise<K> | Future<K> | Stream<K>): Stream<InferStreamResult<K>> {
    const newStream = this.clone();
    newStream.actions.push({ type: ActionType.TRANSFORM, functor: callback as ActionFunctor<T> });
    return newStream as unknown as Stream<InferStreamResult<K>>;
  }

  /**
   * Filters data on the stream using the callback provided
   * @param callback
   */
  filter(callback: (v: T) => boolean | Promise<boolean>): Stream<T> {
    const newStream = this.clone();
    newStream.actions.push({
      type: ActionType.FILTER,
      functor: async (v) => {
        if (v instanceof FutureResult) v = v.value;
        let result = callback(v);
        if (result instanceof Promise) result = await result;
        if (result) return v;
        return null as T;
      },
    });
    return newStream;
  }

  /**
   * group data on the stream into separate slices
   * E.g. Stream yielding 1,2,3,4,5,6 with chunk of 2 => [1,2], [3,4], [5,6]
   * @param value chunk size or function that indicates when to split
   * @param keepSplitCriteria if value provided was a function, this parameter is used to determine if the data used
   * for the split criteria should be added to the chunk, if false then the data will be added to the next chunk
   */
  chunk(value: number | ((v: T) => boolean), keepSplitCriteria: boolean = false): Stream<T[]> {
    const newStream = this.clone();
    if (typeof value === "number" && value < 1) throw new Error("Invalid chunk size");
    let chunkedResults: T[] = [];

    if (typeof value === "number") {
      newStream.actions.push({
        type: ActionType.PACK,
        functor: (v) => {
          chunkedResults.push(v);
          if (chunkedResults.length >= value) {
            const data = chunkedResults;
            chunkedResults = [];
            return { done: true, value: data } as any;
          }
          return { done: false };
        },
      });
    } else {
      newStream.actions.push({
        type: ActionType.TRANSFORM,
        functor: (v) => {
          if (value(v)) {
            if (keepSplitCriteria) chunkedResults.push(v);
            const data = chunkedResults;
            chunkedResults = [];
            return { done: true, value: data } as any;
          }
          chunkedResults.push(v);
          return { done: false };
        },
      });
    }
    return newStream as unknown as Stream<T[]>;
  }

  /**
   * Clones the stream
   */
  clone(): Stream<T> {
    const newStream = new Stream<T>(this.executor);
    newStream.actions = [...this.actions];
    newStream.executed = this.executed;
    newStream.done = this.done;
    newStream.backlog = [...this.backlog];
    return newStream;
  }

  /**
   * Cancels the stream
   * @param reason
   */
  public cancel(reason?: any): void {
    this.controller.abort(reason);
  }

  /**
   * Limits the number of times the stream can yield a value
   * @param count
   */
  take(count: number) {
    const newStream = this.clone();
    let index = 0;

    newStream.actions.push({
      type: ActionType.LIMIT,
      functor: (value) => {
        index++;
        if (index === count) return { done: true, value };
        else if (index > count) return { done: true };
        return { value, done: false };
      },
    });
    return newStream;
  }

  /**
   * Allows the stream to yield only 1 value
   */
  once() {
    return this.take(1);
  }

  /**
   * Skips the first X records on the stream
   * @param count
   */
  skip(count: number) {
    const newStream = this.clone();
    let index = 1;

    newStream.actions.push({
      type: ActionType.FILTER,
      functor: (value) => {
        if (index && index++ <= count) return null;
        index = 0;
        return value;
      },
    });
    return newStream;
  }

  /**
   * Applies rate limiting to the speed at which the data is made available on the stream
   * @param period
   */
  throttleBy(period: WaitPeriod) {
    const newStream = this.clone();
    let future: Future<undefined> | undefined;

    newStream.actions.push({
      type: ActionType.TRANSFORM,
      functor: (value) => {
        if (!future) {
          future = Future.sleep(period)
            .thenApply(() => (future = undefined))
            .schedule();
          return value;
        }
        return null;
      },
    });
    return newStream;
  }

  /**
   * Flattens any nested structure from the data arriving on the stream
   */
  flatten() {
    const newStream = this.clone();

    newStream.actions.push({
      type: ActionType.UNPACK,
      functor: (value) => {
        if (value instanceof Array || value instanceof Set) return R.flatten(value as any[]) as any;
        return [value] as any;
      },
    });
    return newStream as unknown as Stream<Flattened<T>>;
  }

  /**
   * If the stream receives an error, handle that error with the given callback. If callback doesn't throw an error,
   * then the stream will recover and resume with the result provided by the callback
   * @param callback
   */
  catch<K>(callback: (v: Error) => K | null | undefined): Stream<InferErrorResult<K, T> | T> {
    const newStream = this.clone();

    newStream.actions.push({
      type: ActionType.CATCH,
      functor: callback as ActionFunctor<any>,
    });
    return newStream as unknown as Stream<InferErrorResult<K, T> | T>;
  }

  /**
   * Consumes the entire stream and store the data in an array
   */
  collect(): Future<T[]> {
    return new Future(async (resolve, reject) => {
      const collection: T[] = [];

      try {
        for await (const value of this) {
          collection.push(value);
        }
        resolve(collection);
      } catch (error: any) {
        reject(error instanceof FutureError ? error : new FutureError((error?.message as string) ?? "Unknown"));
      }
    });
  }

  /**
   * Continuously exhaust the stream until the stream ends or the limit is reached. No result will be provided at
   * the end
   * @param limit
   */
  consume(limit = Number.POSITIVE_INFINITY): Future<void> {
    return new Future<void>(async (resolve, reject) => {
      try {
        if (limit !== Number.POSITIVE_INFINITY && limit !== Number.NEGATIVE_INFINITY) {
          if (limit === 0) return;

          let index = 0;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const _ of this) {
            if (++index >= limit) break;
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-empty
          for await (const _ of this) {
          }
        }
        resolve();
      } catch (error: any) {
        reject(error instanceof FutureError ? error : new FutureError(error?.message ?? "Unknown"));
      }
    });
  }

  /**
   * Runs the stream only once. After this call, the stream is closed
   */
  async execute(): Promise<T> {
    if (this.executed) throw new CallExecutionError("Cannot rerun a one time stream");
    while (true) {
      const { state, value } = await this.__execute__();

      if (state !== State.CONTINUE) {
        this.done = true;
        return value as T;
      }
    }
  }

  [Symbol.asyncIterator](): AsyncGenerator<T, any, unknown> {
    return this;
  }

  async next(...args: [] | [unknown]): Promise<IteratorResult<T, any>> {
    try {
      while (!this.done) {
        const { state, value } = await this.__execute__();
        if (state === State.MATCHED && value !== undefined) return { done: false, value };
        if (state === State.DONE) {
          this.done = true;
          if (value !== undefined) return { done: false, value };
        }
      }
      return { done: true, value: undefined };
    } catch (error) {
      if (error instanceof StreamEnded) return { done: true, value: null };
      throw error;
    }
  }

  return(value: any): Promise<IteratorResult<T, any>>;
  return(value?: any): Promise<IteratorResult<T, any>>;
  async return(value?: any): Promise<IteratorResult<T, any>> {
    try {
      while (true) {
        const { state, value } = await this.__execute__();
        if (state !== State.CONTINUE) return { done: true, value };
      }
    } catch (error) {
      if (error instanceof StreamEnded) return { done: true, value: null };
      throw error;
    }
  }

  throw(e: any): Promise<IteratorResult<T, any>>;
  throw(e?: any): Promise<IteratorResult<T, any>>;
  async throw(e?: any): Promise<IteratorResult<T, any>> {
    return {
      done: true,
      value: undefined,
    };
  }

  private async checkBacklog(): Promise<{ index: number; data?: any }> {
    if (this.backlog.length === 0) return { index: -1 };

    const { actionIndex, records } = this.backlog[0];
    const index = actionIndex;
    if (records instanceof Stream) {
      const { value: data, done } = await records[Symbol.asyncIterator]().next();
      if (done) {
        this.backlog.shift();
        return await this.checkBacklog();
      }
      return { index, data };
    } else {
      const data = records.shift();
      if (records.length === 0) {
        this.backlog.shift();
      }
      return { index, data };
    }
  }

  protected async __execute__(
    preProcessor: <T>(a: T) => T | Promise<T> = R.identity
  ): Promise<{ state: State; value?: T }> {
    this.executed = true;
    let i = 0;
    let data: any;

    try {
      const { index: actionIndex, data: actionData } = await this.checkBacklog();

      if (actionIndex >= 0) {
        i = actionIndex;
        data = actionData;
      } else if (this.canRunExecutor) {
        do {
          data = this.executor(this.controller.signal);
          do {
            if (data instanceof ExecutorState) {
              this.canRunExecutor = !data.done;
              data = data.value;

              if (!this.canRunExecutor && (data === null || data === undefined)) {
                return { state: State.DONE };
              }
            }
            if (data instanceof Promise) data = await data;
            if (data instanceof Future) data = await data;
            if (data instanceof FutureResult) data = data.value;
            if (data instanceof Stream) {
              this.backlog.push({ actionIndex: 0, records: data });
              return { state: State.CONTINUE };
            }
          } while (data instanceof ExecutorState);
        } while (data === undefined && this.canRunExecutor);
      } else {
        return { state: State.DONE };
      }
    } catch (e) {
      const [value, index] = await this.processError(e, i);
      i = index + 1;
      if (value === undefined || value === null) return { state: State.CONTINUE };
      data = value;
    }

    for (; i < this.actions.length; i++) {
      try {
        const { type, functor } = this.actions[i];
        switch (type) {
          case ActionType.FILTER: {
            const preResult = await this.yieldTrueResult(preProcessor(data));
            const result = await this.yieldTrueResult(
              functor(preResult instanceof Promise ? await preResult : preResult)
            );
            if (result === null || result === undefined) {
              return { state: State.CONTINUE };
            }
            data = result as T;
            break;
          }
          case ActionType.TRANSFORM: {
            const preResult = await this.yieldTrueResult(preProcessor(data));
            const result = await this.yieldTrueResult(
              functor(preResult instanceof Promise ? await preResult : preResult)
            );

            if (result instanceof Stream) {
              this.backlog = [{ actionIndex: i + 1, records: result }, ...this.backlog];
              return { state: State.CONTINUE };
            }
            data = result as T;
            break;
          }
          case ActionType.PACK: {
            const preResult = await this.yieldTrueResult(preProcessor(data));
            const result = (await this.yieldTrueResult(
              functor(preResult instanceof Promise ? await preResult : preResult)
            )) as LimitResult<T>;

            if (!result.done) {
              return { state: State.CONTINUE };
            }
            data = result.value;
            break;
          }
          case ActionType.LIMIT: {
            const preResult = await this.yieldTrueResult(preProcessor(data));
            const result = (await this.yieldTrueResult(
              functor(preResult instanceof Promise ? await preResult : preResult)
            )) as LimitResult<T>;

            if (result.done) {
              this.canRunExecutor = false;
              this.backlog = [];
              this.actions = this.actions.splice(i + 1);
              i = -1;
            }
            data = result.value;
            break;
          }
          case ActionType.UNPACK: {
            const preResult = await this.yieldTrueResult(preProcessor(data));
            const result = (await this.yieldTrueResult(
              functor(preResult instanceof Promise ? await preResult : preResult)
            )) as T[];

            if (result.length === 0) {
              return { state: State.CONTINUE };
            } else if (result.length === 1) {
              data = result[0];
            } else {
              const value = result.shift();
              this.backlog = [{ actionIndex: i + 1, records: result }, ...this.backlog];
              data = value;
            }
          }
        }
      } catch (error: unknown) {
        const [value, index] = await this.processError(error, i);
        i = index;
        if (value !== undefined && value !== null) data = value;
      }
    }
    return { state: State.MATCHED, value: data };
  }

  private async processError(error: unknown, i: number): Promise<[any, number]> {
    let errorMessage: Error;

    if (this.actions.length === 0) throw error;
    else if (!(error instanceof Error)) errorMessage = new Error(error as string);
    else errorMessage = error;

    const catchAction = this.actions.splice(i + 1).find((v, index) => {
      if (v.type === ActionType.CATCH) {
        i = index;
        return true;
      }
      return false;
    });
    if (!catchAction) throw error;
    try {
      const value = catchAction.functor(errorMessage as any);
      return [await this.yieldTrueResult(value), i];
    } catch (e) {
      return await this.processError(e, i);
    }
  }

  private async yieldTrueResult(value: any) {
    if (value instanceof Future) value = await value;
    if (value instanceof FutureResult) value = value.value;
    if (value instanceof Promise) value = await value;
    return value;
  }
}
