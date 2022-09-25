import { Service } from "../../src/annotations/core/Service";
import { GET, POST } from "../../src/annotations/utils/network/requests";
import { Call } from "../../src/annotations/core/Call";
import {
  Authenticator,
  AuthRefresher,
  BaseUrl,
  BinaryResponse,
  Field,
  FormUrlEncoded,
  JSONBody,
  JSONResponse,
  Multipart,
  NoResponse,
  Part,
  StringBody,
  StringResponse,
  XMLBody,
} from "../../src/annotations/utils/network/options";
import { NONE, PASS } from "../../src/annotations/utils/types";
import { BasicCredentials } from "../../src/annotations/core/Credentials";

@BaseUrl("https://test.com")
export class UtilService extends Service {
  @Authenticator(BasicCredentials)
  public loginAnonymously(): BasicCredentials {
    return new BasicCredentials("unknown", `random-${Math.random()}`);
  }

  @POST("api/v1/auth/refresh")
  @JSONResponse(BasicCredentials)
  @AuthRefresher(BasicCredentials)
  private refresh(@JSONBody credentials: BasicCredentials): Call<BasicCredentials> {
    return PASS;
  }

  @GET("/heath")
  @StringResponse
  public healthCheck(): Call<string> {
    return PASS;
  }

  @GET("/download")
  @BinaryResponse
  public downloadFile(): Call<Blob> {
    return PASS;
  }

  @POST("/upload/multipart")
  @Multipart
  @NoResponse
  public uploadFileAndName(@Part("file") file: Blob, @Part("name") name: string): Call<NONE> {
    return PASS;
  }

  @POST("/upload")
  @NoResponse
  public uploadTextFile(@StringBody text: string): Call<NONE> {
    return PASS;
  }

  @POST("/upload/xml")
  @NoResponse
  public uploadXML(@XMLBody xml: Document): Call<NONE> {
    return PASS;
  }

  @POST("/upload/form")
  @FormUrlEncoded
  @NoResponse
  public uploadUserForm(@Field("name") name: string, @Field("age") age: number): Call<NONE> {
    return PASS;
  }
}
