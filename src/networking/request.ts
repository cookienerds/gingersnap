import { Future } from "../future";

type RequestInitDetails = Omit<RequestInit, "signal">;

/**
 * Wraps fetch() to return a future
 * @param input
 * @param init
 */
export const request = (input: RequestInfo | URL, init?: RequestInitDetails) =>
  Future.of<Response>((resolve, reject, signal) => {
    fetch(input, { signal, ...(init ?? {}) })
      .then(resolve)
      .catch(reject);
  });
