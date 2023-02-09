import { Future } from "../future";

export interface Decoder<T> {
  decode: (data: Blob) => Future<T> | Promise<T> | T;
  load?: () => void;
}
