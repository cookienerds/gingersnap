import { NONE, ResponseType, ThrottleByProps } from "../utils/types";
import CallExecutionError from "../../errors/CallExecutionError";
import { Model } from "./Model";
import MissingArgumentsError from "../../errors/MissingArgumentsError";
import * as R from "ramda";

/**
 * Interface for objects that can be called to execute a network request
 */
export interface Callable<T extends Model | Model[] | String | String[] | Blob | Blob[] | NONE> {
  /**
   * Cancels all network requests that have been executed
   * @param reason optional message explaining the cause for cancellation
   */
  cancel: (reason?: any) => void;

  /**
   * Clones this Callable object
   */
  clone: () => Callable<T>;

  /**
   * Execute network requests and returning the associated model/s
   */
  execute: (rawResponse?: boolean) => Promise<T>;
}

abstract class AbstractCall<T extends Model | Model[] | String | String[] | Blob | Blob[] | NONE>
  implements Callable<T>
{
  /**
   * Type of response body expected from the callback's Response Object
   * @protected
   */
  protected readonly responseType?: ResponseType;

  /**
   * Model used to deserialize response object retrieved from the network request
   * @protected
   */
  protected readonly ModelClass?: typeof Model | typeof String;

  /**
   * Used to check if the response is expected to be an array of ModelClass
   * @protected
   */
  protected readonly arrayResponseSupport: boolean;

  protected constructor(ModelClass?: typeof Model | typeof String, responseType?: ResponseType, arrayResponse = false) {
    if (ModelClass != null && responseType === undefined) {
      throw new MissingArgumentsError(["responseType"]);
    }
    if (responseType != null && ModelClass === undefined) {
      throw new MissingArgumentsError(["responseType"]);
    }

    this.ModelClass = ModelClass;
    this.responseType = responseType;
    this.arrayResponseSupport = arrayResponse;
  }

  abstract cancel(reason: any): void;

  abstract clone(): Callable<T>;

  abstract execute(rawResponse?: boolean): Promise<T>;

  /**
   * Converts json object to a Model instance/Array of Models
   * @param json json object
   * @param resp optional Response object
   * @protected
   */
  protected async __process_json__(json: Object | Object[], resp?: Response): Promise<T> {
    if (this.ModelClass?.name === String.name) {
      throw new CallExecutionError("Invalid decorator combination. Cannot use String model with JSON formatting", resp);
    }
    const Class = this.ModelClass as typeof Model;

    if (json instanceof Array && this.arrayResponseSupport) {
      return json.map((v) => Class.fromJSON<any>(v)) as T;
    } else if (!(json instanceof Array) && !this.arrayResponseSupport) {
      return Class.fromJSON<any>(json);
    }

    throw new CallExecutionError("Invalid data format received", resp);
  }

  /**
   * Processes the response body to appropriate return type for a Callable
   * @param resp response object
   * @param responseType ResponseType
   * @protected
   */
  protected async __process_response__(resp: Response, responseType?: ResponseType): Promise<T> {
    switch (responseType) {
      case ResponseType.JSON: {
        const result = await resp.json();
        return await this.__process_json__(result, resp);
      }
      case ResponseType.STRING: {
        const result = await resp.text();
        return new String(result) as T;
      }
      case ResponseType.XML: {
        if (this.ModelClass?.name === String.name) {
          throw new CallExecutionError(
            "Invalid decorator combination. Cannot use String model with JSON formatting",
            resp
          );
        }
        const Class = this.ModelClass as typeof Model;
        return Class.fromXML<any>(await resp.text());
      }
      default:
        return null as T;
    }
  }
}

/**
 * A Callable structure for executing single network request
 */
export class Call<T extends Model | Model[] | String | Blob | NONE> extends AbstractCall<T> {
  /**
   * Callback function that executes a network request. Function should accept an AbortSignal as argument,
   * and return Response object upon completion
   * @private
   */
  private readonly executor: (v: AbortSignal) => Promise<Response>;

  private readonly callback: Function;

  /**
   * AbortController used to cancel http request created by the callback
   * @private
   */
  private readonly controller: AbortController;
  private readonly throttle?: ThrottleByProps;
  private executingCallback: boolean;

  constructor(
    executor: (v: AbortSignal) => Promise<Response>,
    callback: Function,
    ModelClass?: typeof Model | typeof String,
    throttle?: ThrottleByProps,
    responseType?: ResponseType,
    arrayResponse = false
  ) {
    super(ModelClass, responseType, arrayResponse);
    this.controller = new AbortController();
    this.executor = executor;
    this.callback = callback;
    this.throttle = throttle;
    this.executingCallback = false;
  }

  public cancel(reason?: any): void {
    this.controller.abort(reason);
  }

  public clone(): Call<T> {
    return new Call<T>(
      this.executor,
      this.callback,
      this.ModelClass,
      this.throttle,
      this.responseType,
      this.arrayResponseSupport
    );
  }

  public async execute(rawResponse = false): Promise<T> {
    if (this.throttle && this.executingCallback) this.cancel();
    this.executingCallback = true;

    if (this.throttle?.waitPeriodInMs) {
      await new Promise((resolve) => setTimeout(resolve, this.throttle?.waitPeriodInMs));
    }
    const resp = await this.executor(this.controller.signal);
    this.executingCallback = false;

    if (!resp.ok) {
      throw new CallExecutionError(`Received response status code of ${resp.status}`, resp);
    }
    const response = rawResponse
      ? ((await resp.blob()) as T)
      : await this.__process_response__(resp, this.responseType);
    let callbackResponse = this.callback.bind({ context: response })();
    if (callbackResponse instanceof Promise) {
      callbackResponse = await callbackResponse;
    } else if (callbackResponse instanceof AbstractCall) {
      callbackResponse = await callbackResponse.execute();
    }
    if (callbackResponse) return callbackResponse as T;
    return response;
  }
}

/**
 * A Callable Structure for executing multiple requests concurrently
 */
export class CallGroup<T extends Model | Model[] | String | String[] | Blob | Blob[] | NONE> extends AbstractCall<T> {
  /**
   * List of Callable objects that should be executed
   * @private
   */
  private readonly calls: Array<Callable<any>>;
  private readonly race: boolean;

  constructor(
    calls: Array<Callable<any>>,
    race?: boolean,
    ModelClass?: typeof Model | typeof String,
    responseType?: ResponseType,
    arrayResponse = false
  ) {
    super(ModelClass, responseType, arrayResponse);
    this.calls = calls;
    this.race = race ?? false;
  }

  public cancel(reason?: any): void {
    this.calls.forEach((call) => call.cancel(reason));
  }

  public clone(): CallGroup<T> {
    return new CallGroup(this.calls, this.race, this.ModelClass, this.responseType, this.arrayResponseSupport);
  }

  public async execute(rawResponse = false): Promise<T> {
    if (this.ModelClass !== undefined) {
      let responses: Blob[];
      if (this.race) {
        const result = await Promise.race(this.calls.map(async (v) => await v.execute(true)));
        if (result instanceof Array) responses = R.flatten(result);
        else responses = [result];
      } else {
        responses = R.flatten(await Promise.all(this.calls.map(async (v) => await v.execute(true))));
      }

      if (rawResponse) {
        return responses as any;
      }

      switch (this.responseType) {
        case ResponseType.STRING: {
          if (this.arrayResponseSupport) {
            return (await Promise.all(responses.map(async (v) => new String(await v.text())))) as T;
          }
          const texts = await Promise.all(responses.map(async (v) => await v.text()));
          return new String(texts.join("\n")) as T;
        }
        case ResponseType.JSON: {
          const compacted = R.reduce(
            R.mergeDeepWith(R.concat),
            {},
            await Promise.all(responses.map(async (v) => JSON.parse(await v.text())))
          );
          return await this.__process_json__(compacted, undefined);
        }
        case ResponseType.XML:
          throw new CallExecutionError("XML not currently supported");
        case ResponseType.BINARY:
          throw new CallExecutionError("Binary not currently supported");
        default:
          return null as T;
      }
    }

    if (this.race) return [await Promise.race(this.calls.map(async (v) => await v.execute(rawResponse)))] as T;
    return (await Promise.race(this.calls.map(async (v) => await v.execute(rawResponse)))) as T;
  }
}
