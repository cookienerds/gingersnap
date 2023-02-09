import { Decoder } from "./type";
import protobuf, { Message, Root, Type } from "protobufjs";

export class ProtobufDecoder<T extends Message> implements Decoder<T> {
  private readonly proto: object | Root | undefined;
  private readonly typePath: string;
  private type!: Type;

  constructor(proto: object | Root | Type, typePath: string) {
    this.typePath = typePath;
    if (proto instanceof Type) {
      this.type = proto;
    } else {
      this.proto = proto;
    }
  }

  async decode(data: Blob) {
    return this.type.decode(new Uint8Array(await data.arrayBuffer())) as T;
  }

  load() {
    if (this.proto === undefined) {
      return;
    }
    if (this.proto instanceof Root) {
      this.type = this.proto.lookupType(this.typePath);
    } else {
      this.type = protobuf.Root.fromJSON(this.proto).lookupType(this.typePath);
    }
  }
}
