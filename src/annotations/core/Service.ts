import { GingerSnapProps } from "./index";
import { Credentials } from "./Credentials";
import {
  BodyType,
  MapOfHeaders,
  MethodConfiguration,
  RequestType,
  ResponseType,
  ServiceInternalProps,
} from "../utils/types";
import * as R from "ramda";
import { Call } from "./Call";
import CallExecutionError from "../../errors/CallExecutionError";
import { Model } from "./Model";
import { HTTPStatus, THROTTLE_DEFAULT_MS } from "../utils";

type CredentialFunctorWithArg = (credentials: Credentials) => Call<Credentials> | Promise<Credentials> | Credentials;
type CredentialFunctor = () => Call<Credentials> | Promise<Credentials> | Credentials;

interface AuthInstance {
  authRefresher?: CredentialFunctorWithArg;
  authenticator?: CredentialFunctor;
  global: boolean;
}

/**
 * A Snap Service for managing network requests
 */
export class Service {
  /**
   * BaseUrl used by this snap service
   * @private
   */
  private readonly baseUrl?: string;

  /**
   * Request retry limit used by this snap service
   * @private
   */
  private readonly retryLimit?: number;

  /**
   * Internal properties used to construct this snap service
   * @private
   */
  private readonly __internal__!: ServiceInternalProps;

  /**
   * Function that handles authentication refresh
   * @private
   */
  private static authRefresher?: CredentialFunctorWithArg;

  /**
   * Function that handles authentication
   * @private
   */
  private static authenticator?: CredentialFunctor;

  /**
   * Credentials used for authenticated network requests sent by this snap service
   * @private
   */
  private static credentials?: Credentials;

  /**
   * Context representing ResponseData created after the network request is complete.
   * Value varies per network request method, and is scoped to the calling method
   * E.g.
   * class Snap extends Service {
   *   @GET("/data")
   *   @JSONResponse(Data)
   *   public getData(): Call<Data> {
   *     // do post processing with the Data model
   *     console.log('Data model is returned to this.context variable');
   *     console.log(this.context);
   *   }
   * }
   * @protected
   */
  protected context: any;

  constructor({ baseUrl, retryLimit }: GingerSnapProps = {}) {
    this.baseUrl = baseUrl;
    this.retryLimit = retryLimit;
    this.__internal__ = this.__internal__ ?? { classConfig: {}, methodConfig: {} };
  }

  /**
   * Converts the given value to a JSON object
   * @param value Any data
   * @private
   */
  private convertToJSON(value: any): string {
    if (value instanceof Model) {
      return value.json();
    } else if (value instanceof Array) {
      return `[${value.map((v) => this.convertToJSON(v))}]`;
    }
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  /**
   * Internal method called to wrap all network request methods with actual networking functionalities
   * @private
   */
  private __setup__(): void {
    const hostname = this.__internal__.classConfig.baseUrl ?? this.baseUrl ?? "";
    const self = this;
    R.forEach(([key, value]) => {
      let headers = value.headers ?? {};
      const apiPath = value.apiPath ?? "";
      const oldMethod = self[key];
      const auth: AuthInstance = { global: value.authRefresher?.global ?? value.authenticator?.global ?? false };

      if (value.requestType === undefined) {
        this.__setup_authentication__(value, key, self[key], auth);
        return;
      }

      const requestType: RequestType = value.requestType;

      self[key] = (...args: any[]) => {
        let body: any;
        const url = new URL(
          (hostname.endsWith("/") ? hostname.substring(0, hostname.length) : hostname) +
            (apiPath.startsWith("/") ? apiPath : "/" + apiPath)
        );
        return new Call(
          async (signal) => {
            headers = { ...headers, ...this.__get_auth_headers__(auth) };
            if (value.parameters) {
              const paramHeaders = value.parameters.headers ?? {};
              const paramQueries = value.parameters.queries ?? {};
              const paramHeaderPairs: any = R.concat(
                R.toPairs(paramHeaders),
                R.map((k) => [k, (paramHeaders as any)[k]], Object.getOwnPropertySymbols(paramHeaders))
              );
              const paramQueryPairs: any = R.concat(
                R.toPairs(paramQueries),
                R.map((k) => [k, (paramQueries as any)[k]], Object.getOwnPropertySymbols(paramQueries))
              );

              R.forEach(([key, index]: [any, number]) => {
                const arg: any = args[index];
                if (arg === undefined) {
                  throw new CallExecutionError(`header parameter is missing at index ${index}`);
                }
                if (typeof key === "symbol" && typeof arg === "object") {
                  headers = { ...headers, ...arg };
                } else {
                  headers[key] = headers[key] ? `${R.prop(key, headers)};${String(args[index])}` : String(args[index]);
                }
              }, paramHeaderPairs);

              R.forEach(([key, index]: [any, number]) => {
                if (args[index] === undefined) {
                  throw new CallExecutionError(`path parameter is missing at index ${index}`);
                }
                url.pathname = url.pathname.replace(encodeURI(`{${key}}`), encodeURI(args[index]));
              }, R.toPairs(value.parameters.pathVariables ?? {}));

              R.forEach(([key, index]: [any, number]) => {
                const arg = args[index];
                if (arg === undefined) {
                  throw new CallExecutionError(`query parameter is missing at index ${index}`);
                }
                if (typeof key === "symbol" && typeof arg === "object") {
                  R.forEach(([k, v]: [string, string]) => {
                    url.searchParams.set(k, v);
                  }, R.toPairs(arg));
                } else {
                  url.searchParams.set(key, arg);
                }
              }, paramQueryPairs);

              if (value.parameters.body?.type) {
                switch (value.parameters.body.type) {
                  case BodyType.JSON:
                  case BodyType.STRING: {
                    if (value.parameters.body.type === BodyType.JSON) {
                      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
                    }
                    const index = value.parameters.body.parameterIndex;
                    if (args[index] === undefined) {
                      throw new CallExecutionError(`body parameter is missing at index ${index}`);
                    }
                    body = this.convertToJSON(args[index]);
                    break;
                  }
                  case BodyType.XML: {
                    const index = value.parameters.body.parameterIndex;
                    const arg = args[index];
                    if (arg === undefined) {
                      throw new CallExecutionError(`body parameter is missing at index ${index}`);
                    }

                    body = arg instanceof Model ? arg.xml() : new XMLSerializer().serializeToString(arg);
                    break;
                  }
                  case BodyType.FORMURLENCODED: {
                    headers["Content-Type"] = headers["Content-Type"] ?? "application/x-www-form-urlencoded";
                    const formData = new URLSearchParams();
                    R.forEach(([key, index]: [string, number]) => {
                      const arg = args[index];
                      if (arg === undefined) {
                        throw new CallExecutionError(`form field is missing at index ${index}`);
                      }
                      formData.set(key, arg);
                    }, R.toPairs(value.parameters.body.fields));
                    body = formData;
                    break;
                  }
                  case BodyType.MULTIPART: {
                    headers["Content-Type"] = headers["Content-Type"] ?? "multipart/form-data";
                    const formData = new FormData();
                    R.forEach(([key, index]: [string, number]) => {
                      const arg = args[index];
                      if (arg === undefined) {
                        throw new CallExecutionError(`form part is missing at index ${index}`);
                      }
                      formData.append(key, arg);
                    }, R.toPairs(value.parameters.body.parts));
                    body = formData;
                    break;
                  }
                  default:
                    throw new CallExecutionError(`Unsupported body type: ${(value.parameters.body as any)?.type}`);
                }
              }
            }
            let fetcher: (input: RequestInfo | URL, init?: any) => Promise<Response>;
            if (typeof window === "undefined") fetcher = require("node-fetch");
            else fetcher = fetch;
            const lookup = (retries = 0) =>
              fetcher(url, { signal, headers, method: requestType.toString(), body }).then(async (resp) => {
                let credentials: Credentials | undefined;
                if (
                  resp.status === HTTPStatus.UNAUTHORIZED &&
                  self[key] !== auth.authenticator &&
                  self[key] !== auth.authRefresher &&
                  (credentials = await this.__get_credentials__(auth))
                ) {
                  return await fetcher(url, {
                    signal,
                    headers: { ...headers, ...credentials.buildAuthHeaders() },
                    method: requestType.toString(),
                    body,
                  });
                } else if (
                  (resp.status === HTTPStatus.GATEWAY_TIMEOUT || resp.status === HTTPStatus.SERVICE_UNAVAILABLE) &&
                  self.retryLimit &&
                  retries < self.retryLimit
                ) {
                  await new Promise((resolve) => setTimeout(resolve, THROTTLE_DEFAULT_MS));
                  return lookup(retries + 1);
                }
                return resp;
              });

            return lookup();
          },
          oldMethod,
          value.responseClass,
          value.throttle,
          value.responseType ?? ResponseType.NONE,
          value.responseArray === true
        );
      };
      this.__setup_authentication__(value, key, self[key], auth);
    }, R.toPairs(this.__internal__.methodConfig));
  }

  /**
   * Retrieves the authentication headers
   * @param auth AuthInstance
   * @private
   */
  private __get_auth_headers__(auth: AuthInstance): MapOfHeaders {
    const classRef = this.constructor as any as typeof Service;
    if (!auth.global && classRef.credentials) return classRef.credentials.buildAuthHeaders();
    else if (auth.global && Service.credentials) return Service.credentials.buildAuthHeaders();
    return {};
  }

  /**
   * Retrieves the auth credentials, and if no valid on exists, attempt to fetch it via the authenticator/authRefresher
   * @param auth AuthInstance
   * @private
   */
  private async __get_credentials__(auth: AuthInstance): Promise<Credentials | undefined> {
    let result: any;
    let credentials: Credentials;
    const classRef = this.constructor as any as typeof Service;

    if (auth.global && Service.credentials && auth.authRefresher) {
      result = auth.authRefresher(Service.credentials);
    } else if (!auth.global && classRef.credentials && auth.authRefresher) {
      result = auth.authRefresher(classRef.credentials);
    } else if (auth.authenticator) {
      result = auth.authenticator();
    } else {
      return;
    }

    if (result instanceof Call) {
      credentials = await result.execute();
    } else if (result instanceof Promise) {
      credentials = await result;
    } else {
      credentials = result;
    }

    if (auth.global) Service.credentials = credentials;
    else classRef.credentials = credentials;

    return credentials;
  }

  /**
   * Configures authentication if none exist by assigning the authenticator to the correct scope
   * (Global -> Service, Local -> this)
   * @param config MethodConfiguration
   * @param methodName name of the method that should hold the authenticator
   * @param functor authenticator
   * @param auth AuthInstance
   * @private
   */
  private __setup_authentication__(
    config: MethodConfiguration,
    methodName: string,
    functor: CredentialFunctorWithArg | CredentialFunctor,
    auth: AuthInstance
  ) {
    const classRef = this.constructor as any as typeof Service;
    if (config.authenticator) {
      if (config.authenticator.global && !Service.authenticator) {
        Service.authenticator = functor as CredentialFunctor;
      } else if (!config.authenticator.global && !classRef.authenticator) {
        classRef.authenticator = functor as CredentialFunctor;
      }

      const parentRef = config.authenticator.global ? Service : classRef;

      const oldMethod: any = (this as any)[methodName];
      (this as any)[methodName] = (...args: any[]) => {
        const result = oldMethod(...args);
        if (result instanceof Promise) {
          return result.then((v) => {
            if (v instanceof Credentials) {
              parentRef.credentials = v;
            }
            return v;
          });
        } else if (result instanceof Credentials) {
          parentRef.credentials = result;
        }

        return result;
      };
    }

    if (config.authRefresher) {
      if (config.authRefresher.global && !Service.authRefresher) {
        Service.authRefresher = functor;
      } else if (!config.authRefresher.global && !classRef.authRefresher) {
        classRef.authRefresher = functor;
      }
    }

    if (Service.authenticator) {
      auth.authenticator = Service.authenticator;
    } else if (classRef.authenticator) {
      auth.authenticator = classRef.authenticator;
    }

    if (Service.authRefresher) {
      auth.authRefresher = Service.authRefresher;
    } else if (classRef.authRefresher) {
      auth.authRefresher = classRef.authRefresher;
    }
  }
}
