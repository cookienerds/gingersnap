import { Future } from "./future";
import { InferStreamResult } from "../typing/types";
import { Stream } from "../stream";

export type InferredFutureResult<T> = T extends FutureResult<infer U>
  ? InferredFutureResult<U>
  : T extends Promise<infer U>
  ? InferredFutureResult<U>
  : T extends Future<infer U>
  ? InferredFutureResult<U>
  : T extends Stream<any>
  ? InferStreamResult<T>
  : T;

/**
 * Result returned when 1 step of a future completes and the result is passed on to the next step in the future
 * (thenApply)
 */
export class FutureResult<T> {
  /**
   *
   * @param value The returned value from teh previous step in the future
   * @param signal the future signal
   */
  constructor(readonly value: T, readonly signal: AbortSignal) {}
}
