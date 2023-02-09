import { Service } from "./service";
import { Decoder } from "../utils/decoders/type";

export { Call, Callable } from "../utils/call";

export interface GingerSnapProps {
  baseUrl?: string;
  retryLimit?: number;
  cacheServices?: boolean;
  decoder?: Decoder<any>;
  [string: string]: any;
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
   * @param args
   */
  public create<T extends Service>(Class: new (v: GingerSnapProps) => T, args?: GingerSnapProps): T {
    const instance = new Class({
      ...(args ?? {}),
      baseUrl: args?.baseUrl ?? this.baseUrl,
      retryLimit: args?.retryLimit ?? this.retryLimit,
    });
    (instance as any).__setup__();
    return instance;
  }
}
