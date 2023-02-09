import { WaitableObject } from "./WaitableObject";
import { Future, Queue, Stream, WaitPeriod } from "../../utils";

type GetListener<T> = (property: T) => void;
type SetListener<T, K> = (property: T, oldValue: K | undefined, newValue: K) => void;
type DeleteListener<T, K> = (property: T, oldValue: K | undefined) => void;

export interface WatchableChange<T, K> {
  type: WatchableObjectOperations.SET | WatchableObjectOperations.CLEAR | WatchableObjectOperations.DELETE;
  oldValue?: K;
  newValue?: K;
  key: T;
}

export interface Configuration {
  entryThreshold: number;
}

export enum WatchableObjectOperations {
  DELETE,
  GET,
  SET,
  CLEAR,
  VALUES,
}

export class WatchableObject<T, K> extends WaitableObject<T, K> {
  private getListeners: Array<GetListener<T>>;

  private setListeners: Array<SetListener<T, K>>;

  private deleteListeners: Array<DeleteListener<T, K>>;

  private clearListeners: Array<() => void>;

  private valuesListeners: Array<() => void>;

  constructor(objectMaxSize?: number, expiryPeriod?: WaitPeriod) {
    super(objectMaxSize, expiryPeriod);
    this.getListeners = [];
    this.setListeners = [];
    this.deleteListeners = [];
    this.clearListeners = [];
    this.valuesListeners = [];
  }

  clone() {
    return super.clone() as WatchableObject<T, K>;
  }

  /**
   * Stream of changes made to the object via SET, DELETE or CLEAR commands
   * @param queueSize
   */
  changeStream(queueSize?: number) {
    const queue = new Queue<WatchableChange<T, K>>(queueSize);
    const cancelSet = this.onSet((key, oldValue, newValue) =>
      queue.enqueue({
        type: WatchableObjectOperations.SET,
        key,
        oldValue,
        newValue,
      })
    );
    const cancelDelete = this.onDelete((key, oldValue) =>
      queue.enqueue({
        type: WatchableObjectOperations.DELETE,
        key,
        oldValue,
      })
    );
    const cancelClear = this.onClear(() =>
      queue.enqueue({
        type: WatchableObjectOperations.CLEAR,
        key: "*" as any,
      })
    );
    return new Stream<WatchableChange<T, K>>((signal) => {
      signal.onabort = () => {
        cancelClear();
        cancelSet();
        cancelDelete();
      };
      return queue.awaitDequeue(signal);
    });
  }

  /**
   * Listens whenever a value is retrieved from this object
   * @param listener
   * @returns unsubscribe function
   */
  onGet(listener: GetListener<T>) {
    this.getListeners.push(listener);
    return () => {
      this.getListeners = this.getListeners.filter((v) => v !== listener);
    };
  }

  /**
   * Listens whenever a property is added or updated on this object
   * @param listener
   * @returns unsubscribe function
   */
  onSet(listener: SetListener<T, K>) {
    this.setListeners.push(listener);
    return () => {
      this.setListeners = this.setListeners.filter((v) => v !== listener);
    };
  }

  /**
   * Listens whenever a property is deleted from this object
   * @param listener
   * @returns unsubscribe function
   */
  onDelete(listener: DeleteListener<T, K>) {
    this.deleteListeners.push(listener);
    return () => {
      this.deleteListeners = this.deleteListeners.filter((v) => v !== listener);
    };
  }

  /**
   * Listens whenever this object is wiped clean
   * @param listener
   * @returns unsubscribe function
   */
  onClear(listener: () => void) {
    this.clearListeners.push(listener);
    return () => {
      this.clearListeners = this.clearListeners.filter((v) => v !== listener);
    };
  }

  /**
   * Listens whenever the values() method is invoked on this object
   * @param listener
   * @returns unsubscribe function
   */
  onValues(listener: () => void) {
    this.valuesListeners.push(listener);
    return () => {
      this.valuesListeners = this.valuesListeners.filter((v) => v !== listener);
    };
  }

  get(key: T, defaultValue?: K | undefined) {
    void Future.sleep(1)
      .thenApply(() => this.getListeners.forEach((listener) => listener(key)))
      .run();
    return super.get(key, defaultValue);
  }

  set(key: T, value: K, expiryPeriod?: WaitPeriod) {
    const oldValue = this.get(key);
    super.set(key, value, expiryPeriod);
    this.setListeners.forEach((listener) => listener(key, oldValue, value));
  }

  delete(key: T) {
    const oldValue = this.get(key);
    super.delete(key);
    if (oldValue !== undefined) this.deleteListeners.forEach((listener) => listener(key, oldValue));
  }

  clear() {
    super.clear();
    this.clearListeners.forEach((listener) => listener());
  }

  await(key: T, abort?: AbortSignal) {
    return super.await(key, abort).thenApply((value) => {
      void Future.sleep(1)
        .thenApply(() => this.getListeners.forEach((listener) => listener(key)))
        .run();
      return value.value;
    }) as Future<K>;
  }

  on(key: T, callback: (value: K) => void, multiCall = true) {
    return super.on(
      key,
      (v) => {
        void Future.sleep(1)
          .thenApply(() => this.getListeners.forEach((listener) => listener(key)))
          .run();
        callback(v);
      },
      multiCall
    );
  }

  values(copy?: boolean) {
    void Future.sleep(1)
      .thenApply(() => this.valuesListeners.forEach((listener) => listener()))
      .run();
    return super.values(copy);
  }
}
