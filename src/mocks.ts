import { RequestType } from "./annotations/service/types";
import { Future, ObjectOf, WaitPeriod } from "./utils";
import { AbortError } from "./error";
import { VerificationError } from "./errors/VerificationError";
import { HTTPStatus } from "./service";

type Validator = (matches: Response[]) => boolean;

/**
 * Tracks specific details that should be used to match specific given network request
 */
class RequestDetails {
  private method?: string;
  private path?: string;
  private headers: ObjectOf<string>;
  private queries: ObjectOf<string>;
  private body?: string | any;

  constructor() {
    this.headers = {};
    this.queries = {};
  }

  withMethod(method: RequestType) {
    this.method = method;
    return this;
  }

  withPath(path: string) {
    this.path = path;
    return this;
  }

  withHeader(key: string, value: string) {
    this.headers[key] = value;
    return this;
  }

  withHeaders(value: { [string: string]: string }) {
    this.headers = value;
    return this;
  }

  withQuery(key: string, value: string) {
    this.queries[key] = value;
    return this;
  }

  withQueries(value: { [string: string]: string }) {
    this.queries = value;
    return this;
  }

  withBody(value: string | any) {
    this.body = value;
    return this;
  }
}

class ResponseBuilder {
  private status: HTTPStatus;
  private headers: ObjectOf<string>;
  private body?: string | Blob;
  private uri?: string;
  private fragment?: string;
  private delay?: WaitPeriod;

  constructor() {
    this.status = HTTPStatus.OK;
    this.headers = {};
  }

  withStatus(status: HTTPStatus) {
    this.status = status;
    return this;
  }

  withHeader(key: string, value: string) {
    this.headers[key] = value;
    return this;
  }

  withHeaders(value: { [string: string]: string }) {
    this.headers = value;
    return this;
  }

  withBody(value: string | Blob) {
    this.body = value;
    return this;
  }

  withURI(value: string) {
    this.uri = value;
    return this;
  }

  withFragment(value: string) {
    this.fragment = value;
    return this;
  }

  withDelay(value: WaitPeriod) {
    this.delay = value;
    return this;
  }

  build() {
    let data: Blob | undefined;

    if (this.body && typeof this.body === "string") {
      data = new Blob([this.body]);
    } else if (this.body instanceof Blob) {
      data = this.body;
    }

    const status = this.status ?? HTTPStatus.OK;
    const response = new Response(data, {
      status,
      statusText: Object.keys(HTTPStatus)
        .find((key) => HTTPStatus[key] === status)
        ?.toLowerCase()
        .split("_")
        .map((v) => v[0].toUpperCase() + v.slice(1))
        .join(" "),
      headers: Object.entries(this.headers),
    });
    if (this.uri) {
      const url = new URL(this.uri);
      if (this.fragment) {
        url.hash = this.fragment;
      }

      Object.defineProperty(response, "url", { value: url.href });
    }

    return { response, delay: this.delay };
  }
}

class API {
  private readonly matchers: Array<(req: Request) => Promise<Response | undefined>>;

  private processedRequests: Array<[Request, Response]>;

  constructor() {
    this.matchers = [];
    this.processedRequests = [];
  }

  private async resolve(req: Request) {
    const resp = await this.findMatchingResponse(req);

    if (resp) {
      this.processedRequests.push([req, resp]);
      return resp;
    }

    return new Response(null, { status: HTTPStatus.NOT_FOUND });
  }

  when(request: RequestDetails, response: ResponseBuilder) {
    this.matchers.push(this.createMatcher(request, response));
    return this;
  }

  async verify(request: RequestDetails, validator: Validator) {
    const matcher = this.requestMatcher(request);
    const responses = await Promise.all(
      this.processedRequests.map(([req, resp]) => matcher(req).then((v) => (v ? resp : null)))
    );
    if (!validator(responses.filter((v) => v !== null) as Response[])) {
      throw new VerificationError();
    }
  }

  reset() {
    this.processedRequests = [];
  }

  private async findMatchingResponse(request: Request) {
    for (const matcher of this.matchers) {
      const resp = await matcher(request);
      if (resp) {
        return resp;
      }
    }
  }

  private requestMatcher(mock: RequestDetails) {
    const mockRequest = mock as any;

    const pathChecker = (req: Request) =>
      mockRequest.path ? new URL(req.url).pathname.startsWith(mockRequest.path) : true;
    const methodChecker = (req: Request) =>
      mockRequest.method ? req.method.toUpperCase() === mockRequest.method : true;
    const headersChecker = (req: Request) =>
      Object.entries(mockRequest.headers).every(([k, v]) => req.headers.get(k) === v);

    const bodyChecker = (req: Request) => {
      if (!mockRequest.body) {
        return Promise.resolve(true);
      }

      const data = typeof mockRequest.body !== "string" ? JSON.stringify(mockRequest.body) : mockRequest.body;
      const buffer = new TextEncoder().encode(data);

      return req.arrayBuffer().then((v) => {
        const data = new Uint8Array(v);

        for (let i = 0; i < buffer.length; i++) {
          if (buffer.at(i) !== data.at(i)) {
            return false;
          }
        }
        return true;
      });
    };
    const queriesChecker = (req: Request) => {
      const params = new URL(req.url).searchParams;
      return Object.entries(mockRequest.queries).every(([k, v]) => params.get(k) === v);
    };

    return (req: Request) =>
      bodyChecker(req).then(
        (result) => result && queriesChecker(req) && headersChecker(req) && pathChecker(req) && methodChecker(req)
      );
  }

  private createMatcher(mockRequest: RequestDetails, response: ResponseBuilder) {
    const matcher = this.requestMatcher(mockRequest);
    return (request: Request) =>
      matcher(request).then(async (match) => {
        if (match) {
          const { response: resp, delay } = response.build();

          if (delay) {
            await Future.sleep(delay);
          }

          return resp;
        }
      });
  }
}

/**
 * Mocks network requests send via fetch API
 */
export class MockNetworkService {
  private readonly realFetch: typeof global.fetch;

  private future?: Future<void>;

  private readonly apis: Map<string, API>;

  /**
   * @param blockUnmatchedOrigins check whether to block requests sent to origins not specified as
   * an API in this network service
   */
  constructor(private readonly blockUnmatchedOrigins: boolean = true) {
    this.realFetch = global.fetch;
    this.apis = new Map();
  }

  /**
   * Launches the network service to monitor requests
   */
  start() {
    this.future = Future.of((resolve, reject, signal) => {
      signal.onabort = () => {
        global.fetch = this.realFetch;
        reject(new AbortError());
      };

      global.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const req = new Request(input, init);
        const uri = new URL(req.url);
        const api = this.apis.get(uri.origin);

        if (!api && this.blockUnmatchedOrigins) {
          return Promise.resolve(new Response(null, { status: HTTPStatus.NOT_FOUND }));
        } else if (!api) {
          return this.realFetch(input, init);
        }

        return (api as any).resolve(req);
      };
    }).schedule() as Future<void>;
  }

  /**
   * Stops network monitoring
   */
  stop() {
    if (this.future) {
      this.future.cancel();
      this.future = undefined;
    }
  }

  /**
   * Creates an API service - used to intercept requests for a given origin
   * @param origin
   */
  createAPI(origin: string) {
    const api = new API();
    this.apis.set(origin, api);
    return api;
  }

  /**
   * Remove all created API services from network request routing
   */
  reset() {
    this.apis.clear();
  }
}

/**
 * Validators
 */

/**
 * Validates that the request was processed at least X times
 * @param amount number of times the request was sent
 */
export const atLeast = (amount: number) => (matches: Response[]) => matches.length >= amount;

/**
 * Validates that the request was process at most X times
 * @param amount number of times the request was sent
 */
export const atMost = (amount: number) => (matches: Response[]) => matches.length <= amount;

/**
 * Validates that the request was processed exactly X times
 * @param amount number of times the request was sent
 */
export const exact = (amount: number) => (matches: Response[]) => matches.length === amount;

/**
 * Validates that the request was processed within the given range of times
 * @param lower minimum times the request matched
 * @param upper maximum times the request matched
 * @param includeUpper if true, the upper limit provided with be included. Otherwise, the maximum will be upper - 1
 */
export const range =
  (lower: number, upper: number, includeUpper: boolean = false) =>
  (matches: Response[]) =>
    matches.length >= lower && (includeUpper ? matches.length <= upper : matches.length < upper);

/**
 * creates a request details instance that is used to track requests with a given set of criteria
 */
export const request = () => new RequestDetails();

/**
 * creates a response builder
 */
export const response = () => new ResponseBuilder();
