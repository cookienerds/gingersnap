import { Future, FutureResult } from "../future";

/**
 * Context managers allow you to allocate and release resources irrespective of
 * an executor failing to complete successfully
 */
export interface ContextManager<T> {
  with: (functor: (value: FutureResult<T>) => any) => Future<any>;
}
