import { WatchableObject } from "./WatchableObject";
import { TimeableObject } from "./TimeableObject";
import * as R from "ramda";
import { Future, WaitPeriod } from "../../future";
import { Stream } from "../../stream";
import { ExecutorState } from "../../stream/state";

/**
 * Queue data structure that is iterable, but never can dequeue
 */
export class BufferQueue<T> extends WatchableObject<number, T> {
  private tail: number;
  private head: number;
  private readonly tracker: TimeableObject<string | number, number>;

  constructor(objectMaxSize?: number, expiryPeriod?: WaitPeriod) {
    super(objectMaxSize, expiryPeriod);
    this.tail = 0;
    this.head = 0;
    this.tracker = new TimeableObject(objectMaxSize, expiryPeriod);
  }

  ingest(stream: Stream<T>): Future<void> {
    return this.ingestStream(stream, (data) => this.enqueue(data));
  }

  streamEntries(ignoreCache = false): Stream<T> {
    let pointer = ignoreCache ? this.tail : 0;
    return new Stream(((signal) => {
      const value = this.get(pointer);
      if (value !== undefined) {
        pointer++;
        return value as T;
      }
      return new Promise((resolve) => {
        const unsubscribe = this.on(
          pointer,
          (v: any) => {
            pointer++;
            resolve(v);
          },
          false
        );
        signal.onabort = () => {
          unsubscribe();
          resolve(new ExecutorState(true) as any);
        };
      });
    }) as any);
  }

  clone() {
    const obj: any = super.clone();
    obj.head = this.head;
    obj.tail = this.tail;
    obj.tracker = this.tracker;
    return obj as BufferQueue<T>;
  }

  enqueue(value: T, tracker?: string | number) {
    this.set(this.tail, value);

    if (!R.isNil(tracker)) {
      this.tracker.set(tracker, this.tail);
    }

    this.tail++;
    if (!this.has(this.head)) {
      this.head++;
    }
  }

  clear() {
    super.clear();
    this.tail = 0;
    this.head = 0;
    this.tracker.clear();
  }

  get empty() {
    return this.tail <= this.head;
  }

  size(): number {
    return this.tail - this.head;
  }

  peek(index?: number) {
    return this.get(index ?? this.head);
  }

  findIndex(tracker: string | number) {
    return this.tracker.get(tracker);
  }
}
