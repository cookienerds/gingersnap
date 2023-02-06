import { WatchableObject } from "./WatchableObject";
import { Future, Stream, WaitPeriod } from "../../utils";

/**
 * Queue data structure that is iterable, but never can dequeue
 */
export class BufferQueue<T> extends WatchableObject<number, T> {
  private tail: number;
  private head: number;

  constructor(objectMaxSize?: number, expiryPeriod?: WaitPeriod) {
    super(objectMaxSize, expiryPeriod);
    this.tail = 0;
    this.head = 0;
  }

  get streamEntries(): Stream<T> {
    let pointer = 0;
    return new Stream(((signal) => {
      const value = this.get(pointer);
      if (value !== undefined) {
        pointer++;
        return value as T;
      }
      return Future.of<T>((resolve, reject, signal) => {
        signal.onabort = this.on(pointer, (v) => {
          pointer++;
          resolve(v as any);
        });
      }, signal);
    }) as any);
  }

  clone() {
    const obj: any = super.clone();
    obj.head = this.head;
    obj.tail = this.tail;
    return obj as BufferQueue<T>;
  }

  enqueue(value: T) {
    this.set(this.tail, value);
    this.tail++;
    if (!this.has(this.head)) {
      this.head++;
    }
  }

  clear() {
    super.clear();
    this.tail = 0;
    this.head = 0;
  }

  get empty() {
    return this.tail <= this.head;
  }

  size(): number {
    return this.tail - this.head;
  }

  peek() {
    return this.get(this.head);
  }
}
