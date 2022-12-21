import { AnyDataType } from "../types";
import { TimeableObject } from "./TimeableObject";
import AbortError from "../../errors/AbortError";

/**
 * Object that allows you to wait until property exists, and perform some action on them
 */
export class WaitableObject extends TimeableObject {
  /**
   * Listeners that are waiting for the value at a specific path to exist only once
   * @private
   */
  private readonly singleListeners: Map<string, Array<(value: AnyDataType | PromiseLike<any>) => void>>;

  /**
   * Listeners that are always waiting for the value at the specific path to be set/updated
   * @private
   */
  private readonly multiListeners: Map<string, Array<(value: AnyDataType) => void>>;

  constructor(objectMaxSize?: number, expiryMs?: number) {
    super(objectMaxSize, expiryMs);
    this.singleListeners = new Map();
    this.multiListeners = new Map();
  }

  /**
   * Retrieves the value at the given path once it exists
   * @param key path
   * @param abort signal to cancel waiting on result
   */
  async await(key: string | string[] | number | number[], abort?: AbortSignal): Promise<AnyDataType> {
    if (this.has(key)) {
      return super.get(key);
    }

    return await new Promise((resolve, reject) => {
      const hashKey = this.computeHash(key);
      const listeners = this.singleListeners.get(hashKey) ?? [];
      const abortCallback = () => {
        let listeners = this.singleListeners.get(hashKey);

        if (listeners) {
          listeners = listeners.filter((v) => v !== resolve);
          this.singleListeners.set(hashKey, listeners);
        }
        reject(new AbortError());
      };
      listeners.push((v) => {
        abort?.removeEventListener("abort", abortCallback);
        resolve(v);
      });
      abort?.addEventListener("abort", abortCallback, { once: true });
      this.singleListeners.set(hashKey, listeners);
    });
  }

  /**
   * Retrieves the value at the given path once it exists, or the value changes
   * @param key path
   * @param callback callback function that is trigger once value exist or is changed
   */
  on(key: string | string[], callback: (value: AnyDataType) => void) {
    const hashKey = this.computeHash(key);
    const cancel = () => {
      const listeners = (this.multiListeners.get(hashKey) ?? []).filter((v) => v !== callback);
      this.multiListeners.set(hashKey, listeners);
    };

    if (this.has(key)) {
      callback(this.get(key));
    }

    const listeners = this.multiListeners.get(hashKey) ?? [];
    listeners.push(callback);
    this.multiListeners.set(hashKey, listeners);
    return cancel;
  }

  set(key: string | Array<string | number> | number, value: AnyDataType, expiryMs?: number) {
    super.set(key, value, expiryMs);
    const hashKey = this.computeHash(key);
    const listeners = this.singleListeners.get(hashKey) ?? [];
    listeners.forEach((listener) => listener(value));
    this.singleListeners.delete(hashKey);

    (this.multiListeners.get(hashKey) ?? []).forEach((listener) => listener(value));
  }
}
