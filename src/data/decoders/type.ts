import { Future } from "../../future";

/**
 * Used for converting data from Blob to a given format
 */
export interface Decoder<T> {
  decode: (data: Blob) => Future<T> | Promise<T> | T;
  load?: () => void;
}
