import { Decoder } from "./type";

export class JSONDecoder<T> implements Decoder<T> {
  async decode(data: Blob) {
    return JSON.parse(await data.text());
  }
}
