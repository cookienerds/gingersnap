import { QueueEmptyError } from "../../errors";

export class SimpleQueue<T> {
  private items: Map<number, T>;
  private head: number;
  private tail: number;

  constructor() {
    this.items = new Map();
    this.head = 0;
    this.tail = 0;
  }

  enqueue(element: T) {
    this.items.set(this.tail, element);
    this.tail++;
  }

  forEach(callback: (v: T) => void) {
    while (!this.empty) {
      const result = this.dequeue();
      if (result === undefined) return;

      callback(result);
    }
  }

  dequeue() {
    if (this.empty) {
      throw new QueueEmptyError();
    }

    const item = this.items.get(this.head);
    this.items.delete(this.head);
    this.head++;
    return item as T;
  }

  peek() {
    if (this.empty) {
      throw new QueueEmptyError();
    }

    return this.items.get(this.head) as T;
  }

  size(): number {
    return this.tail - this.head;
  }

  get empty() {
    return this.size() === 0;
  }

  clone() {
    const obj = new SimpleQueue<T>();
    obj.items = new Map(this.items);
    obj.tail = this.tail;
    obj.head = this.head;
    return obj;
  }
}
