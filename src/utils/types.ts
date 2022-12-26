import { WaitableObject, WatchableObject } from "./object";

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
  | WaitableObject
  | WatchableObject
  | boolean[]
  | File
  | File[];

export type AnyType = AnyDataType | Function | Promise<AnyDataType>;
export type Flattened<T> = T extends Array<infer U> ? Flattened<U> : T;
