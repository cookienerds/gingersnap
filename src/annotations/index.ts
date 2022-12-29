import { Service } from "./service";

export { Call, Callable } from "../utils/call";

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
    const instance = new Class({ baseUrl: baseUrl ?? this.baseUrl, retryLimit: this.retryLimit });
    (instance as any).__setup__();
    return instance;
  }
}
