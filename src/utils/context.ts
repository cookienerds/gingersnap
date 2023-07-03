import { Future, FutureResult } from "./future";

export interface ContextManager<T> {
  with: (functor: (value: FutureResult<T>) => any) => Future<any>;
}
