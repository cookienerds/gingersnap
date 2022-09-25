import { Service } from "../../src/annotations/core/Service";
import {
  Authenticator,
  AuthRefresher,
  Field,
  FormUrlEncoded,
  JSONBody,
  JSONResponse,
} from "../../src/annotations/utils/network/options";
import { BearerCredentials } from "../../src/annotations/core/Credentials";
import { PASS } from "../../src/annotations/utils/types";
import { Call } from "../../src/annotations/core/Call";
import { POST } from "../../src/annotations/utils/network/requests";

export class AuthService extends Service {
  @POST("api/v1/auth/login")
  @FormUrlEncoded
  @JSONResponse(BearerCredentials)
  @Authenticator(BearerCredentials, true)
  public loginWithEmailAndPassword(
    @Field("email") email: string,
    @Field("password") password: string
  ): Call<BearerCredentials> {
    return PASS;
  }

  @POST("api/v1/auth/refresh")
  @JSONResponse(BearerCredentials)
  @AuthRefresher(BearerCredentials, true)
  private refresh(@JSONBody credentials: BearerCredentials): Call<BearerCredentials> {
    return PASS;
  }
}
