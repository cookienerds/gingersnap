import { Call } from "../Call";
import CallExecutionError from "../../errors/CallExecutionError";
import { ResponseType, ThrottleByProps } from "./types";
import { Model } from "../model";
import R from "ramda";

export class Stream<T> extends Call<any> implements AsyncGenerator<T> {
  private executed: boolean;
  private readonly actions: Array<(v: T) => T | null>;

  constructor(
    executor: (v: AbortSignal) => Promise<Response>,
    callback: Function,
    ModelClass?: typeof Model | typeof String,
    throttle?: ThrottleByProps,
    responseType?: ResponseType,
    arrayResponse?: boolean
  ) {
    super(executor, callback, ModelClass, throttle, responseType, arrayResponse);
    this.executed = false;
    this.actions = [];
  }

  map<K>(callback: (v: T) => K): Stream<K> {
    const newStream = this.clone();
    newStream.actions.push(callback as any);
    return newStream as unknown as Stream<K>;
  }

  filter(callback: (v: T) => boolean) {
    const newStream = this.clone();
    newStream.actions.push(R.ifElse(callback, R.identity, R.always(null)));
    return newStream;
  }

  chunk(value: number | ((v: T) => boolean), keepSplitCriteria: boolean = false): Stream<T[]> {
    const newStream = this.clone();
    if (typeof value === "number" && value < 1) throw new Error("Invalid chunk size");
    let chunkedResults: T[] = [];

    if (typeof value === "number") {
      newStream.actions.push((v) => {
        chunkedResults.push(v);
        if (chunkedResults.length >= value) {
          const data = chunkedResults;
          chunkedResults = [];
          return data as any;
        }
        return null;
      });
    } else {
      newStream.actions.push((v) => {
        if (value(v)) {
          if (keepSplitCriteria) chunkedResults.push(v);
          const data = chunkedResults;
          chunkedResults = [];
          return data as any;
        }
        chunkedResults.push(v);
        return null;
      });
    }
    return newStream as unknown as Stream<T[]>;
  }

  [Symbol.asyncIterator](): AsyncGenerator<T, any, unknown> {
    return this;
  }

  next(...args: [] | [unknown]): Promise<IteratorResult<T, any>>;
  next(...args: [] | [unknown]): Promise<IteratorResult<T, any>>;
  async next(...args: [] | [unknown]): Promise<IteratorResult<T, any>> {
    while (true) {
      const value = await this.execute();
      if (value !== undefined) return { done: false, value };
    }
  }

  return(value: any): Promise<IteratorResult<T, any>>;
  return(value?: any): Promise<IteratorResult<T, any>>;
  async return(value?: any): Promise<IteratorResult<T, any>> {
    while (true) {
      const value = await this.execute();
      if (value !== null) return { done: true, value };
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

  clone(): Stream<T> {
    return new Stream<T>(
      this.executor,
      this.callback,
      this.ModelClass,
      this.throttle,
      this.responseType,
      this.arrayResponseSupport
    );
  }

  async execute(rawResponse: boolean = false): Promise<T> {
    if (this.executed) throw new CallExecutionError("Cannot rerun a one time stream");
    this.executed = true;
    let data = await super.execute(rawResponse);
    for (const action of this.actions) {
      const result = action(data);
      if (result === null) {
        return null as any;
      }
      data = result;
    }
    return data;
  }
}
