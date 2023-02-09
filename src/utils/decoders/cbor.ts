import { Decoder } from "./type";
import { decode as cborDecode } from "cborg";

export class CborDecoder<T> implements Decoder<T> {
  async decode(data: Blob) {
    return cborDecode(new Uint8Array(await data.arrayBuffer())) as T;
  }
}
