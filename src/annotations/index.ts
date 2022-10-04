import { Callable, CallGroup } from "./Call";
import { Model } from "./model";
import { Service } from "./service";

export { Call, CallGroup, Callable } from "./Call";
export * from "./Credentials";

export interface GingerSnapProps {
  baseUrl?: string;
  retryLimit?: number;
  cacheServices?: boolean;
}

const DEFAULT_RETRY_LIMIT = 3;

/**
 * Core Service for creating Snap Services - services that manage network requests
 */
export class GingerSnap {
  /**
   * The baseUrl used by all snap services
   * @private
   */
  private readonly baseUrl?: string;

  /**
   * The retry limit used by all snap services
   * @private
   */
  private readonly retryLimit: number;

  constructor({ baseUrl, retryLimit = DEFAULT_RETRY_LIMIT }: GingerSnapProps = {}) {
    this.baseUrl = baseUrl;
    this.retryLimit = retryLimit;
  }

  /**
   * Creates a new instance of the provided SnapService
   * @param Class A SnapService class
   * @param baseUrl host used by the service
   */
  public create<T extends Service>(Class: new (v: GingerSnapProps) => T, baseUrl?: string): T {
    const instance = new Class({ baseUrl: this.baseUrl, retryLimit: this.retryLimit });
    (instance as any).__setup__();
    return instance;
  }

  /**
   * Creates a CallGroup that groups the given Callables
   * @param calls A list of Callables
   * @param ModelType Class used to serialize the smashed response from the callables
   */
  public group<T extends Model>(calls: Array<Callable<any>>, ModelType: any): CallGroup<T> {
    return new CallGroup<T>(calls, false, ModelType);
  }

  /**
   * Returns when the first one finishes or errors out
   * @param calls
   * @param ModelType
   */
  public race<T extends Model[]>(calls: Array<Callable<any>>, ModelType: any): CallGroup<T> {
    return new CallGroup<T>(calls, true, ModelType);
  }
}
