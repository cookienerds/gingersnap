import {
  GET,
  POST,
  Service,
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
  NONE,
  PASS,
} from "../../src/annotations/service";
import { User } from "./user";
import { BasicCredentials } from "../../src/annotations/model/credentials";
import { Call } from "../../src/utils";

@BaseUrl("https://test.com")
export class UtilService extends Service {
  @Authenticator(BasicCredentials)
  public loginAnonymously(): BasicCredentials {
    return new BasicCredentials("unknown", `random-${Math.random()}`);
  }

  @POST("api/v1/auth/refresh")
  @JSONResponse({ modelType: BasicCredentials })
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
  public uploadXML(@XMLBody user: User): Call<NONE> {
    return PASS;
  }

  @POST("/upload/form")
  @FormUrlEncoded
  @NoResponse
  public uploadUserForm(@Field("name") name: string, @Field("age") age: number): Call<NONE> {
    return PASS;
  }
}
