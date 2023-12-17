import hash from "object-hash";
import { CyclicalObject } from "./CyclicalObject";
import { Future, WaitPeriod } from "../../utils/future";

/**
 * Object that has key value pairs that can expire
 */
export class TimeableObject<T, K> extends CyclicalObject<T, K> {
  /**
   * default expiration time for each added key value pair
   * @private
   */
  protected expiryPeriod?: WaitPeriod;

  /**
   * mapping of timings for each key value pair
   * @private
   */
  private readonly timers: Map<string, Future<void>>;

  constructor(objectMaxSize?: number, expiryPeriod?: WaitPeriod) {
    super(objectMaxSize);
    this.timers = new Map();
    this.expiryPeriod = expiryPeriod;
  }

  /**
   * Sets the value for the given key
   * @param key
   * @param value dat to be stored
   * @param expiryPeriod When should this value expire
   */
  set(key: T, value: K, expiryPeriod?: WaitPeriod) {
    const hashedKey = this.computeHash(key);
    const timer = this.timers.get(hashedKey);
    timer?.cancel();

    super.set(key, value);
    if (expiryPeriod ?? this.expiryPeriod) {
      this.timers.set(
        hashedKey,
        Future.sleep(expiryPeriod ?? this.expiryPeriod ?? 0)
          .thenApply(() => this.delete(key))
          .schedule()
      );
    }
  }

  get(key: T, defaultValue: K | undefined = undefined): K | undefined {
    const result = super.get(key, defaultValue);

    if (result !== undefined) {
      if (this.expiryPeriod) {
        const hashedKey = this.computeHash(key);
        const timer = this.timers.get(hashedKey);
        timer?.cancel();

        this.timers.set(
          hashedKey,
          Future.sleep(this.expiryPeriod ?? 0)
            .thenApply(() => this.delete(key))
            .schedule()
        );
      }
    }

    return result;
  }

  delete(key: T) {
    const hashedKey = this.computeHash(key);
    const timer = this.timers.get(hashedKey);
    timer?.cancel();
    this.timers.delete(hashedKey);
    super.delete(key);
  }

  clear() {
    this.timers.forEach((future) => future.cancel());
    this.timers.clear();
    super.clear();
  }

  clone() {
    const obj: any = super.clone();
    obj.expiryPeriod = this.expiryPeriod;
    return obj as TimeableObject<T, K>;
  }

  protected computeHash(key: T) {
    return hash.sha1(String(key));
  }
}
