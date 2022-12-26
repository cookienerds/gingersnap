import { AnyDataType } from "../types";
import * as R from "ramda";
import hash from "object-hash";
import { CyclicalObject } from "./CyclicalObject";

/**
 * Object that has key value pairs that can expire
 */
export class TimeableObject extends CyclicalObject {
  /**
   * default expiration time for each added key value pair
   * @private
   */
  private readonly expiryMs?: number;

  /**
   * mapping of timings for each key value pair
   * @private
   */
  private readonly timers: Map<string, number>;

  constructor(objectMaxSize?: number, expiryMs?: number) {
    super(objectMaxSize);
    this.timers = new Map();
    this.expiryMs = expiryMs;

    Object.getOwnPropertyNames(this).forEach((v) => {
      if (this[v] instanceof Function) {
        this[v] = this[v].bind(this);
      }
    });
  }

  /**
   * Retrieves the value at the given path
   * @param key path for the value
   */
  get(key: string | Array<string | number> | number): AnyDataType {
    if (key instanceof Array && key.length < 1) {
      throw new RangeError("key path is empty");
    }
    if (key instanceof Array) {
      return R.view(R.lensPath(key), this.targetObject);
    }
    return this.targetObject.get(key);
  }

  /**
   * Sets the value for the given path
   * @param key path for the value
   * @param value dat to be stored
   * @param expiryMs When should this value expire in milliseconds (Optional)
   */
  set(key: string | Array<string | number> | number, value: AnyDataType, expiryMs?: number) {
    const hashedKey = this.computeHash(key);
    const timer = this.timers.get(hashedKey);
    if (timer) {
      clearTimeout(timer);
    }

    if (key instanceof Array && key.length > 0) {
      if (this.targetObject.get(key[0])?.set instanceof Function) {
        (this.targetObject.get(key[0]) as TimeableObject).set(R.drop(1, key), value);
      } else if (key.length === 1) {
        this.targetObject.set(key[0], value);
      } else {
        this.targetObject.set(key[0], R.assocPath(key, value, this.targetObject).get(key[0]));
      }

      if (expiryMs ?? this.expiryMs) {
        this.timers.set(
          hashedKey,
          setTimeout(() => {
            this.delete(key);
          }, expiryMs ?? this.expiryMs) as unknown as number
        );
      }
    } else if (key instanceof Array && key.length === 0) {
      throw new Error("Keys length should be greater than zero");
    } else {
      this.targetObject.set(key, value);
      if (expiryMs ?? this.expiryMs) {
        this.timers.set(
          hashedKey,
          setTimeout(() => {
            this.targetObject.delete(key);
          }, expiryMs ?? this.expiryMs) as unknown as number
        );
      }
    }
  }

  /**
   * Removes the value at the given path
   * @param key
   */
  delete(key: string | Array<string | number> | number) {
    const hashedKey = this.computeHash(key);

    if (this.timers.has(hashedKey)) {
      const timer = this.timers.get(hashedKey);
      this.timers.delete(hashedKey);
      clearTimeout(timer);
    }

    if (key instanceof Array && key.length > 0) {
      if (this.targetObject.get(key[0])?.delete instanceof Function) {
        (this.targetObject.get(key[0]) as TimeableObject).delete(R.drop(1, key));
      } else if (key.length === 1) {
        this.targetObject.delete(key[0]);
      } else {
        this.targetObject.set(key[0], R.dissocPath<any>(key, this.targetObject).get(key[0]));
      }
    } else if (key instanceof Array && key.length === 0) {
      throw new Error("key length should be greater than zero");
    } else {
      this.targetObject.delete(key);
    }
  }

  clear() {
    this.timers.forEach((token) => clearTimeout(token));
    this.timers.clear();
    super.clear();
  }

  /**
   * Retrieves all the keys for this timeable object
   */
  keys() {
    return this.targetObject.keys();
  }

  /**
   * Checks if the timeable object has a value for the given path
   * @param key Path of the value that we are checking if exists
   */
  has(key: string | Array<string | number> | number) {
    return key instanceof Array ? R.hasPath(key as any[], this.targetObject) : R.has(key as any, this.targetObject);
  }

  protected computeHash(key: string | Array<string | number> | number) {
    return hash.sha1(key);
  }
}
