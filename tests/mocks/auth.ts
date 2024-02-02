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
} from "../../src/service";
import { BearerCredentials } from "../../src/annotations/model/credentials";
import { Call } from "../../src/utils";

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
