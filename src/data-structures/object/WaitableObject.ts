import { TimeableObject } from "./TimeableObject";
import { Future, WaitPeriod } from "../../utils";
import { v4 as uuid } from "uuid";

/**
 * Object that allows you to wait until property exists, and perform some action on them
 */
export class WaitableObject<T, K> extends TimeableObject<T, K> {
  /**
   * Listeners that are waiting for the value at a specific path to exist or updated
   * @private
   */
  private readonly listeners: Map<string, [T, (v: K) => void, boolean]>;

  constructor(objectMaxSize?: number, expiryPeriod?: WaitPeriod) {
    super(objectMaxSize, expiryPeriod);
    this.listeners = new Map();
  }

  /**
   * Retrieves the value at the given path once it exists
   * @param key path
   * @param abort signal to cancel waiting on result
   */
  await(key: T, abort?: AbortSignal): Future<K> {
    if (this.has(key)) {
      return Future.completed(super.get(key) as K);
    }
    const guid = uuid();

    return new Future<K>((resolve, reject, signal) => {
      this.listeners.set(guid, [key, resolve, false]);
      signal.onabort = () => {
        this.listeners.delete(guid);
      };
    }, abort);
  }

  /**
   * Retrieves the value at the given key once it exists, or the value changes
   * @param key path
   * @param callback callback function that is trigger once value exist or is changed
   * @returns unsubscribe function
   */
  on(key: T, callback: (value: K) => void) {
    const guid = uuid();
    this.listeners.set(guid, [key, callback, true]);
    return () => this.listeners.delete(guid);
  }

  set(key: T, value: K, expiryPeriod?: WaitPeriod) {
    super.set(key, value, expiryPeriod);
    for (const [guid, [k, callback, multiCall]] of this.listeners.entries()) {
      if (k !== key) continue;
      callback(value);
      if (!multiCall) this.listeners.delete(guid);
    }
  }

  clone() {
    return super.clone() as WaitableObject<T, K>;
  }
}
