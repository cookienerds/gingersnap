import { Decoder } from "./type";
import { decode as msgUnpack } from "@msgpack/msgpack";

export class MsgpackDecoder<T> implements Decoder<T> {
  async decode(data: Blob) {
    return msgUnpack(new Uint8Array(await data.arrayBuffer())) as T;
  }
}
