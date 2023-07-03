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
  Service,
} from "../../src/annotations/service";
import { BearerCredentials } from "../../src/annotations/model/credentials";
import { Call } from "../../src/utils";

export class AuthService extends Service {
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
