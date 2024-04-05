import { Decoder } from "./type";

/**
 * Converts Blob to JSON object
 */
export class JSONDecoder<T> implements Decoder<T> {
  async decode(data: Blob) {
    return JSON.parse(await data.text());
  }
}
