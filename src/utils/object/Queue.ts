import { WatchableObject } from "./WatchableObject";
import QueueEmptyError from "../../errors/QueueEmptyError";
import { AnyDataType } from "../types";

export class Queue<T extends AnyDataType> extends WatchableObject implements Iterator<T> {
  private writePointer: number;
  private maxSize?: number;
  private readPointer: number;

  constructor(objectMaxSize?: number, expiryMs?: number) {
    super(objectMaxSize, expiryMs);
    this.writePointer = -1;
    this.readPointer = -1;
    this.maxSize = objectMaxSize;
  }

  get asyncIterator(): AsyncGenerator<T> {
    const self = this;
    const generator = {
      [Symbol.asyncIterator](): AsyncGenerator<T> {
        return generator;
      },
      return(value?: any): any {
        return value;
      },
      throw(e?: any): any {
        throw e;
      },
      async next(...args: [] | [unknown]): Promise<IteratorResult<T>> {
        return { done: false, value: await self.awaitPop() };
      },
    };
    return generator;
  }

  [Symbol.iterator](): Iterator<T> {
    return this;
  }

  next(...args: [] | [undefined]): IteratorResult<T, any> {
    if (!this.empty) return { done: false, value: this.pop() };
    return { done: true, value: undefined };
  }

  return?(value?: any): IteratorResult<T, any> {
    return this.next();
  }

  throw?(e?: any): IteratorResult<T, any> {
    throw e;
  }

  close() {
    this.targetObject.clear();
  }

  clear() {
    const objectMaxSize = this.maxSize;
    this.targetObject.clear();
    this.writePointer = -1;
    this.readPointer = -1;
    this.maxSize = objectMaxSize;
  }

  get empty() {
    return this.tail <= this.head;
  }

  push(value: T) {
    this.set(this.tailForward(), value);
  }

  pop() {
    if (this.empty) throw new QueueEmptyError();
    const value = this.get(this.headForward());
    this.delete(this.head);
    return value as T;
  }

  async awaitPop(abortSignal?: AbortSignal) {
    let value: T;
    if (this.empty) {
      value = (await this.await(this.headForward(), abortSignal)) as T;
    } else {
      value = this.get(this.headForward()) as T;
    }

    this.delete(this.head);
    return value;
  }

  private get head() {
    return this.readPointer;
  }

  private get tail() {
    return this.writePointer;
  }

  private headForward() {
    if (this.maxSize) {
      this.readPointer = (this.readPointer + 1) % this.maxSize;
    } else {
      this.readPointer++;
    }
    return this.readPointer;
  }

  private tailForward() {
    if (this.maxSize) {
      this.writePointer = (this.writePointer + 1) % this.maxSize;
    } else {
      this.writePointer++;
    }

    return this.writePointer;
  }
}
