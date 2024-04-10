import {
  Authenticator,
  AuthRefresher,
  Field,
  FormUrlEncoded,
  JSONBody,
  JSONResponse,
  OptionalField,
  PASS,
  POST,
  NetworkService,
} from "../../src/networking";
import { BearerCredentials } from "../../src/data/model";
import { Call } from "../../src/stream/call";

export class AuthService extends NetworkService {
  @POST("api/v1/auth/login")
  @FormUrlEncoded
  @JSONResponse({ modelType: BearerCredentials })
  @Authenticator(BearerCredentials, true)
  public loginWithEmailAndPassword(
    @Field("email") email: string,
    @OptionalField("password") password?: string
  ): Call<BearerCredentials> {
    return PASS;
  }

  @POST("api/v1/auth/refresh")
  @JSONResponse({ modelType: BearerCredentials })
  @AuthRefresher(BearerCredentials, true)
  private refresh(@JSONBody credentials: BearerCredentials): Call<BearerCredentials> {
    return PASS;
  }
}
