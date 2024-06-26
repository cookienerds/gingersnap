import { CyclicalList } from "./CyclicalList";
import { NotImplemented, StackEmptyError, StackFullError } from "../../errors";
import { FutureEvent } from "../../synchronize";
import { Stream } from "../../stream";
import { Future } from "../../future";

/**
 * Stack data structure for Last In First Out operation (LIFO)
 */
export class Stack<T> extends CyclicalList<T> {
  private readonly evt: FutureEvent;
  private totalEntries: number;

  constructor(maxSize?: number) {
    super(maxSize);
    this.totalEntries = 0;
    this.evt = new FutureEvent();
  }

  unshift(...items): number {
    throw new NotImplemented();
  }

  shift(): T | undefined {
    throw new NotImplemented();
  }

  get stream(): Stream<T> {
    return new Stream<T>((v) => this.awaitPop(v));
  }

  push(...items): number {
    this.evt.set();
    this.totalEntries++;
    if (this.maxSize && this.totalEntries > this.maxSize) {
      throw new StackFullError();
    }
    return super.push(...items);
  }

  pop() {
    if (this.length === 0) throw new StackEmptyError();
    this.evt.clear();
    this.totalEntries--;
    return super.pop() as T;
  }

  /**
   * Awaits a value being available on the stack to retrieve it
   * @param abortSignal
   */
  awaitPop(abortSignal?: AbortSignal): Future<T> {
    if (this.size() === 0) {
      const future = this.evt.wait();
      if (abortSignal) future.registerSignal(abortSignal);
      return (future as any).then((v) => {
        if (this.size() > 0) return this.pop();
        return this.awaitPop(v.signal);
      });
    }
    return Future.completed(this.pop());
  }

  /**
   * Retrieves the last item added to the stack
   */
  peek() {
    return this[this.pointer];
  }

  /**
   * Checks if the stack is empty
   */
  get empty() {
    return this.totalEntries === 0;
  }

  /**
   * Checks if the stack is full
   */
  get full() {
    return this.size() === this.maxSize;
  }

  /**
   * Retrieves the current stack size
   */
  size() {
    return this.totalEntries;
  }

  /**
   * Empty the stack
   */
  clear() {
    while (!this.empty) {
      this.pop();
    }
  }
}
