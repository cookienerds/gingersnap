import CallExecutionError from "../errors/CallExecutionError";
import StreamEnded from "../errors/StreamEnded";
import * as R from "ramda";
import { AnyDataType, Flattened, InferErrorResult, InferStreamResult } from "./types";
import { Future, FutureResult, WaitPeriod } from "./future";
import FutureCancelled from "../errors/FutureCancelled";
import { ExecutorState } from "./state";

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

  public static asCompleted(futures: Array<Future<any>>, timeout: WaitPeriod | number) {
    return new Stream(async (signal) => {
      signal.onabort = () => {
        futures.forEach((future) => future.cancel());
      };
      if (signal.aborted) throw new FutureCancelled();

      if (futures.length > 0) {
        const result = await Promise.race(
          futures.map((future, index) => future.thenApply((v) => [v.value, index] as [any, number]))
        );
        const [value, index] = result;
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete futures[index];
        return value;
      }
    });
  }

  static empty() {
    return new Stream<null>(() => null);
  }

  static fromBatchIterator<K extends AnyDataType>(
    batchGenerator: (batchSize?: number, ...args: any[]) => Promise<K>,
    batchSize = 1,
    ...args: any[]
  ) {
    return new Stream<K>(async (signal) => {
      if (!signal.aborted) {
        const result = await batchGenerator(batchSize, ...args);
        if (result instanceof Array) return new ExecutorState(result.length === 0, result) as any;
        return new ExecutorState(R.isNil(result), result) as any;
      }
    })
      .flatten()
      .filter(R.complement(R.isNil));
  }

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
      return new Stream<K>(async (signal) => {
        value.registerSignal(signal);
        return new ExecutorState(true, await value) as any;
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

  get future(): Future<T> {
    return Future.of<T>((resolve, reject, signal) => {
      if (!signal.aborted) {
        signal.onabort = () => this.cancel();
        this.execute()
          .then(resolve as any)
          .catch(reject);
      }
    }) as Future<T>;
  }

  map<K>(callback: (v: T) => K | Promise<K> | Future<K> | Stream<K>): Stream<InferStreamResult<K>> {
    const newStream = this.clone();
    newStream.actions.push({ type: ActionType.TRANSFORM, functor: callback as ActionFunctor<T> });
    return newStream as unknown as Stream<InferStreamResult<K>>;
  }

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

  clone(): Stream<T> {
    const newStream = new Stream<T>(this.executor);
    newStream.actions = [...this.actions];
    newStream.executed = this.executed;
    newStream.done = this.done;
    newStream.backlog = [...this.backlog];
    return newStream;
  }

  public cancel(reason?: any): void {
    this.controller.abort(reason);
  }

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

  once() {
    return this.take(1);
  }

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

  catch<K>(callback: (v: Error) => K | null | undefined): Stream<InferErrorResult<K, T> | T> {
    const newStream = this.clone();

    newStream.actions.push({
      type: ActionType.CATCH,
      functor: callback as ActionFunctor<any>,
    });
    return newStream as unknown as Stream<InferErrorResult<K, T> | T>;
  }

  async collect() {
    const collection: T[] = [];

    for await (const value of this) {
      collection.push(value);
    }
    return collection;
  }

  async consume(limit = Number.POSITIVE_INFINITY) {
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

  async execute(): Promise<T> {
    if (this.executed) throw new CallExecutionError("Cannot rerun a one time stream");
    while (true) {
      const { state, value } = await this.__execute__();

      if (state !== State.CONTINUE) return value as T;
    }
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

    if (!data) {
      try {
        const { index: actionIndex, data: actionData } = await this.checkBacklog();

        if (actionIndex >= 0) {
          i = actionIndex;
          data = actionData;
        } else if (this.canRunExecutor) {
          data = this.executor(this.controller.signal);
          if (data instanceof Future) data = (await data).value;
          if (data instanceof FutureResult) data = data.value;
          if (data instanceof Promise) data = await data;
          if (data instanceof ExecutorState) {
            this.canRunExecutor = !data.done;
            data = data.value;
          }
        } else {
          return { state: State.DONE };
        }
      } catch (e) {
        const [value, index] = await this.processError(e, i);
        i = index + 1;
        if (value === undefined || value === null) return { state: State.CONTINUE };
        data = value;
      }
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
    if (value instanceof Future) value = (await value).value;
    if (value instanceof FutureResult) value = value.value;
    if (value instanceof Promise) value = await value;
    return value;
  }
}
