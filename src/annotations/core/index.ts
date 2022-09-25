import { Service } from "./Service";
import { Callable, CallGroup } from "./Call";
import { Model } from "./Model";

export interface GingerSnapProps {
  baseUrl?: string;
  retryLimit?: number;
  cacheServices?: boolean;
}

const DEFAULT_RETRY_LIMIT = 3;

export class GingerSnap {
  private readonly baseUrl?: string;
  private readonly retryLimit: number;

  constructor({ baseUrl, retryLimit = DEFAULT_RETRY_LIMIT }: GingerSnapProps = {}) {
    this.baseUrl = baseUrl;
    this.retryLimit = retryLimit;
  }

  public create<T extends Service>(Class: new (v: GingerSnapProps) => T, baseUrl?: string): T {
    const instance = new Class({ baseUrl: this.baseUrl, retryLimit: this.retryLimit });
    (instance as any).__setup__();
    return instance;
  }

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
