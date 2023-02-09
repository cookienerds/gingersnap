import * as R from "ramda";
import { Stream } from "../../utils";

/**
 * Object that is cyclical - has can store M keys, after which new key value pairs added override
 * previous entries.
 */
export class CyclicalObject<T, K> implements Iterable<[T, K]> {
  /**
   * Underlying javascript object
   * @private
   */
  private readonly realTargetObject: Map<T, K>;

  /**
   * Listing of all the keys added in order
   * @private
   */
  private readonly indexes: T[];

  /**
   * Pointer to the current index
   * @private
   */
  private pointer: number;

  /**
   * Maximum size of this object
   * @private
   */
  protected readonly objectMaxSize?: number;

  public constructor(objectMaxSize?: number) {
    this.realTargetObject = new Map();
    this.indexes = new Array(objectMaxSize);
    this.pointer = -1;
    this.objectMaxSize = objectMaxSize;
  }

  public static from<T, K>(data: Map<T, K> | Array<[T, K]> | { T: K }) {
    const obj = new this<T, K>();
    if (data instanceof Map) {
      for (const [k, v] of data.entries()) {
        obj.set(k, v);
      }
    } else if (data instanceof Array) {
      for (const [k, v] of data) {
        obj.set(k, v);
      }
    } else {
      for (const [k, v] of Object.entries(data)) {
        obj.set(k as T, v);
      }
    }

    return obj;
  }

  get stream() {
    return Stream.of(this);
  }

  /**
   * Retrieves the value associated with the given key. If not exist, the default response will be returned
   * @param key
   * @param defaultValue
   */
  get(key: T, defaultValue: K | undefined = undefined) {
    const result = this.realTargetObject.get(key);
    return result !== undefined ? result : defaultValue;
  }

  /**
   * Add the given key value pair to the object. This will overwrite any existing entry that has the same key
   * @param key
   * @param value
   */
  set(key: T, value: K) {
    if (this.objectMaxSize) {
      if (this.realTargetObject.has(key)) {
        this.realTargetObject.set(key, value);
        return;
      }

      this.pointer = this.objectMaxSize ? (this.pointer + 1) % this.objectMaxSize : this.pointer + 1;
      const prop = this.indexes[this.pointer];
      if (prop !== undefined) {
        this.realTargetObject.delete(prop);
      }

      this.realTargetObject.set(key, value);
      this.indexes[this.pointer] = key;
      return;
    }
    this.realTargetObject.set(key, value);
  }

  /**
   * Removes the value associated with the given key if it exists
   * @param key
   */
  delete(key: T) {
    this.realTargetObject.delete(key);
  }

  /**
   * Checks if the object has the given key
   * @param key
   */
  has(key: T) {
    return this.realTargetObject.has(key);
  }

  /**
   * Iterates over each entry in the object by executing the provided callback on each entry
   * @param callback
   */
  forEach(callback: (value: K, key: T, map: Map<T, K>) => void) {
    this.realTargetObject.forEach(callback);
  }

  [Symbol.iterator]() {
    return this.realTargetObject[Symbol.iterator]();
  }

  /**
   * Wipes all key value pairs
   */
  clear() {
    this.pointer = -1;
    this.realTargetObject.clear();
  }

  /**
   * Retrieves all the values from this object
   * @param copy Used to create a copied view of the values
   */
  values(copy?: boolean) {
    const values = Array.from(this.realTargetObject.values());
    return copy ? R.clone(values) : values;
  }

  /**
   * Retrieves the keys that are stored in this object
   */
  keys() {
    return this.realTargetObject.keys();
  }

  /**
   * Retrieves the object size
   */
  size() {
    return this.pointer > -1 ? this.pointer + 1 : this.realTargetObject.size;
  }

  clone() {
    const obj: any = new (Object.getPrototypeOf(this).constructor)();
    obj.realTargetObject = new Map(this.realTargetObject);
    obj.indexes = [...this.indexes];
    obj.pointer = this.pointer;
    obj.objectMaxSize = this.objectMaxSize;
    return obj as CyclicalObject<T, K>;
  }
}
