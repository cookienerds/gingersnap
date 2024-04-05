import { Decoder } from "./type";

/**
 * Converts Blob to string data
 */
export class StringDecoder implements Decoder<string> {
  decode(data: Blob) {
    return data.text();
  }
}
