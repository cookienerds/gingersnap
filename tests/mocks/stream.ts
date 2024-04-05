import { Stream } from "../../src/stream";
import { Model, Field } from "../../src/data/model";
import { WebSocketService, WriteStream, PASS, JSONResponse, ReadStream } from "../../src/networking";

export class Address extends Model {
  @Field() address!: string;
  @Field() city!: string;
  @Field() state!: string;
  @Field() postalCode!: string;
}

export class StreamUser extends Model {
  @Field() firstName!: string;

  @Field() lastName!: string;
  @Field() maidenName!: string;
  @Field() age!: number;
  @Field() address!: Address;
}

export class UserStream extends WebSocketService {
  @WriteStream
  public saveUser(user: StreamUser): Stream<void> {
    return PASS;
  }

  @JSONResponse({ modelType: StreamUser })
  @ReadStream(["address", "state"], "DC")
  public getDCUsers(): Stream<StreamUser> {
    return PASS;
  }
}
