import { WaitableObject, WatchableObject } from "../data-structures/object";
import { Stream } from "./stream";
import { Future } from "./future";
import { InferredFutureResult } from "./future/result";
import { ExecutorState } from "./state";

export interface ObjectOf<T> {
  [string: string]: T;
}

export type AnyObject =
  | {
      [string: string]: AnyDataType;
    }
  | Map<string, AnyDataType>;

export type AnyDataType =
  | AnyObject
  | Blob
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  | void
  | Response
  | AnyObject[]
  | string
  | string[]
  | number
  | number[]
  | boolean
  | undefined
  | null
  | Date
  | RegExp
  | Map<any, any>
  | WaitableObject<any, any>
  | WatchableObject<any, any>
  | boolean[]
  | File
  | File[];

export type AnyType = AnyDataType | Function | Promise<AnyDataType>;
export type Flattened<T> = T extends Array<infer U> ? Flattened<U> : T;
export type InferStreamResult<T> = T extends Stream<infer U>
  ? InferStreamResult<U>
  : T extends Future<infer U>
  ? InferredFutureResult<U>
  : T extends ExecutorState<infer U>
  ? U
  : T;

export type FlagExcludedType<Base, Type> = { [Key in keyof Base]: Base[Key] extends Type ? never : Key };
export type AllowedNames<Base, Type> = FlagExcludedType<Base, Type>[keyof Base];
export type OmitType<Base, Type> = Pick<Base, AllowedNames<Base, Type>>;
export type InferErrorResult<T, K> = T extends undefined | null ? K : T;
export type UnaryFunctor<K, V> = (v: K) => V;
export type BinaryFunctor<K1, K2, V> = (v1: K1, v2: K2) => V;
export type TernaryFunctor<K1, K2, K3, V> = (v1: K1, v2: K2, v3: K3) => V;
