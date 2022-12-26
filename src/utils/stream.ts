import CallExecutionError from "../errors/CallExecutionError";
import StreamEnded from "../errors/StreamEnded";
import { wait, WaitPeriod } from "./timer";
import * as R from "ramda";
import { AnyDataType, Flattened } from "./types";
import { Future, FutureResult } from "./future";
import FutureCancelled from "../errors/FutureCancelled";

enum ActionType {
  TRANSFORM,
  LIMIT,
  UNPACK,
  PACK,
}

enum State {
  MATCHED,
  CONTINUE,
  DONE,
}

interface LimitResult<T> {
  value?: T;
  done: boolean;
}
type ActionFunctor<T> = (v: T) => T | null | Promise<T> | LimitResult<T> | Promise<LimitResult<T>>;

export class Stream<T> implements AsyncGenerator<T> {
  private executed: boolean;

  private actions: Array<{ type: ActionType; functor: ActionFunctor<T> }>;

  private done: boolean;

  private backlog: Array<{ records: T[]; actionIndex: number }>;

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
  protected readonly executor: (v: AbortSignal) => Promise<AnyDataType>;

  constructor(executor: (v: AbortSignal) => Promise<AnyDataType>) {
    this.executor = executor;
    this.controller = new AbortController();
    this.executed = false;
    this.done = false;
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
          futures.map((future, index) => future.then((v) => [v.value, index] as [any, number]))
        );
        const [value, index] = result.value;
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete futures[index];
        return value;
      }
    });
  }

  static of<K>(value: Iterable<K> | AsyncGenerator<K>) {
    if (value[Symbol.iterator]) {
      const iterator = value[Symbol.iterator]();
      return new Stream<K>((signal) => {
        if (!signal.aborted) return iterator.next().value;
      });
    }

    const iterator = value[Symbol.asyncIterator]();
    return new Stream<K>(async (signal) => {
      if (!signal.aborted) return (await iterator.next()).value;
    });
  }

  map<K>(callback: (v: T) => K | Promise<K>): Stream<K> {
    const newStream = this.clone();
    newStream.actions.push({ type: ActionType.TRANSFORM, functor: callback as ActionFunctor<T> });
    return newStream as unknown as Stream<K>;
  }

  filter(callback: (v: T) => boolean | Promise<boolean>): Stream<T> {
    const newStream = this.clone();
    newStream.actions.push({
      type: ActionType.TRANSFORM,
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
    newStream.actions = this.actions;
    newStream.executed = this.executed;
    newStream.done = this.done;
    newStream.backlog = this.backlog;
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
        if (index >= count) return { done: true, value };
        return { value, done: false };
      },
    });
    return newStream;
  }

  skip(count: number) {
    const newStream = this.clone();
    let index = 1;

    newStream.actions.push({
      type: ActionType.TRANSFORM,
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
    let future: Future<void> | undefined;

    newStream.actions.push({
      type: ActionType.TRANSFORM,
      functor: (value) => {
        if (!future) {
          future = wait(period).then(() => (future = undefined));
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

  async collect() {
    const collection: T[] = [];

    for await (const value of this) {
      collection.push(value);
    }
    return collection;
  }

  [Symbol.asyncIterator](): AsyncGenerator<T, any, unknown> {
    return this;
  }

  next(...args: [] | [unknown]): Promise<IteratorResult<T, any>>;
  next(...args: [] | [unknown]): Promise<IteratorResult<T, any>>;
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
    return (await this.__execute__()).value!;
  }

  private async __execute__(): Promise<{ state: State; value?: T }> {
    this.executed = true;
    let data: any;
    let index = 0;

    if (this.backlog.length > 0) {
      const { actionIndex, records } = this.backlog[0];
      index = actionIndex;
      data = records.shift();
      if (records.length === 0) {
        this.backlog.shift();
      }
    } else {
      data = await this.executor(this.controller.signal);
    }

    for (let i = index; i < this.actions.length; i++) {
      const { type, functor } = this.actions[i];
      switch (type) {
        case ActionType.TRANSFORM: {
          let result = functor(data);

          if (result instanceof Promise) result = await result;
          if (result === null || result === undefined) {
            return { state: State.CONTINUE };
          }
          data = result as T;
          break;
        }
        case ActionType.PACK: {
          let result = functor(data) as LimitResult<T>;

          if (result instanceof Promise) result = await result;
          if (!result.done) {
            return { state: State.CONTINUE };
          }
          data = result.value;
          break;
        }
        case ActionType.LIMIT: {
          let result = functor(data) as LimitResult<T>;

          if (result instanceof Promise) result = await result;
          if (result.done) {
            return { state: State.DONE, value: result.value };
          }
          data = result.value;
          break;
        }
        case ActionType.UNPACK: {
          let result = functor(data) as T[];

          if (result instanceof Promise) result = await result;
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
    }
    return { state: State.MATCHED, value: data };
  }
}
