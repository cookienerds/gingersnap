import { Decoder } from "./type";

export class StringDecoder implements Decoder<string> {
  decode(data: Blob) {
    return data.text();
  }
}
