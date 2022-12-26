import * as R from "ramda";

/**
 * Object that is cyclical - has can store M keys, after which new key value pairs added override
 * previous entries.
 */
export class CyclicalObject implements Iterable<any> {
  /**
   * Proxy object
   * @protected
   */
  protected readonly targetObject: Map<any, any>;

  /**
   * Underlying javascript object
   * @private
   */
  private readonly realTargetObject: Map<any, any>;

  /**
   * Listing of all the keys added in order
   * @private
   */
  private readonly indexes: Array<string | symbol>;

  /**
   * Pointer to the current index
   * @private
   */
  private pointer: number;

  constructor(objectMaxSize?: number) {
    this.realTargetObject = new Map();
    this.indexes = new Array(objectMaxSize);
    this.pointer = -1;

    const properties = Object.getOwnPropertyNames(Object.getPrototypeOf(this.realTargetObject)).filter(
      (v) => v !== "constructor"
    );
    this.targetObject = objectMaxSize
      ? (new Proxy(this.realTargetObject, {
          get: (target: {}, p: string | symbol, receiver: any) => {
            if (properties.includes(p as string)) return (...args: any[]) => this.realTargetObject[p](...args);
            return Reflect.get(target, p, receiver);
          },
          set: (target: {}, p: string | symbol, value: any, receiver: any) => {
            this.pointer = (this.pointer + 1) % objectMaxSize;
            const key = this.indexes[this.pointer];
            if (key !== undefined) {
              this.realTargetObject.delete(key);
            }

            this.realTargetObject.set(p, value);
            this.indexes[this.pointer] = p;
            return true;
          },
          deleteProperty: (target: Map<any, any>, p: string) => {
            return this.realTargetObject.delete(p);
          },
        }) as any)
      : this.realTargetObject;

    Object.getOwnPropertyNames(this).forEach((v) => {
      if (this[v] instanceof Function) {
        this[v] = this[v].bind(this);
      }
    });
  }

  [Symbol.iterator](): Iterator<any, any, undefined> {
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
    const values = this.pointer > -1 ? this.indexes.map(this.realTargetObject.get) : this.realTargetObject.values();
    return copy ? R.clone(values) : values;
  }

  count() {
    return this.pointer > -1 ? this.pointer + 1 : this.realTargetObject.size;
  }
}
