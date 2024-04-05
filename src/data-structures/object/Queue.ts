import { WatchableObject } from "./WatchableObject";
import { QueueEmptyError } from "../../errors";
import { Future, WaitPeriod } from "../../future";
import { Stream } from "../../stream";
import { reject } from "ramda";

/**
 * Queue data structure for First In First Out operation (FIFO)
 */
export class Queue<T> extends WatchableObject<number, T> implements Iterator<T> {
  private tail: number;
  private head: number;

  constructor(objectMaxSize?: number, expiryPeriod?: WaitPeriod) {
    super(objectMaxSize, expiryPeriod);
    this.tail = 0;
    this.head = 0;
  }

  get streamEntries() {
    return Stream.of(this.asyncIterator);
  }

  clone() {
    const obj: any = super.clone();
    obj.head = this.head;
    obj.tail = this.tail;
    return obj as Queue<T>;
  }

  ingest(stream: Stream<T>): Future<void> {
    return this.ingestStream(stream, (data) => this.enqueue(data));
  }

  enqueue(value: T) {
    this.set(this.tail, value);
    this.tail++;
  }

  dequeue() {
    const value = this.get(this.head);
    if (value !== undefined && value !== null) {
      this.delete(this.head);
      this.head++;
      return value;
    }
    throw new QueueEmptyError();
  }

  awaitDequeue(abortSignal?: AbortSignal) {
    if (this.empty) {
      return this.await(this.head, abortSignal).thenApply((v) => {
        this.delete(this.head);
        this.head++;
        return v.value;
      }) as Future<T>;
    }
    return Future.completed(this.dequeue());
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
        return {
          done: false,
          value: await self.awaitDequeue(),
        };
      },
    };
    return generator;
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

  next(...args: [] | [undefined]): IteratorResult<T, any> {
    if (!this.empty) {
      return {
        done: false,
        value: this.dequeue(),
      };
    }
    return {
      done: true,
      value: undefined,
    };
  }

  return?(value?: any): IteratorResult<T, any> {
    return this.next();
  }

  throw?(e?: any): IteratorResult<T, any> {
    throw e;
  }
}
