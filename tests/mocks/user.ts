import { Call } from "../../src";
import {
  Path,
  Headers,
  Header,
  Query,
  QueryMap,
  JSONResponse,
  XMLResponse,
  DELETE,
  GET,
  POST,
  PUT,
  Service,
  HeaderMap,
  Throttle,
  ThrottleBy,
  JSONBody,
  PASS,
} from "../../src/annotations/service";
import { ArrayField, Field, Ignore, Model } from "../../src/annotations/model";
import "reflect-metadata";

export class User extends Model {
  @Field() name!: string;
  @ArrayField(User) friends!: User[];
  @Field("contact_no") tel!: string;
  @Field("timestamp") createdOn!: Date;

  @Ignore()
  @Field()
  bestie?: User;

  updatedAt!: Date;
  references!: number;

  @Field("updatedAt")
  private computeLastUpdate(value: string): void {
    this.updatedAt = new Date(value);
  }

  @Field()
  private totalReferences(value: number): void {
    this.references = Number(value);
  }
}

export class UserProfile extends User {
  @Field() profilePicture!: string;
  @Field() bioLink!: string;
}

export class UserProfilePage extends Model {
  @Field() profile!: UserProfile;
}

export class UserService extends Service {
  @GET("users")
  @JSONResponse({ modelType: User, isArray: true })
  public getUsers(): Call<User[]> {
    return PASS;
  }

  @GET("users")
  @JSONResponse({ modelType: User })
  @Throttle
  public getUserByName(@Query("name") name: string): Call<User> {
    return PASS;
  }

  @GET("users?tel=1234567")
  @JSONResponse({ modelType: User })
  @ThrottleBy({ waitPeriodInMs: 1000 })
  public getUserByTel(@Query("tel") tel: string): Call<User> {
    return PASS;
  }

  @GET("users")
  @JSONResponse({ modelType: User })
  public getUserByProperties(@QueryMap properties: { [string: string]: string }): Call<User> {
    return PASS;
  }

  @JSONResponse({ modelType: User })
  @POST("users")
  public createUser(@JSONBody user: User): Call<User> {
    return PASS;
  }

  @PUT("users/{id}")
  @JSONResponse({ modelType: User })
  public updateUser(
    @JSONBody user: User,
    @Path("id") id: string,
    @HeaderMap headers: { [string: string]: string }
  ): Call<User> {
    return PASS;
  }

  @DELETE("users/{id}")
  @JSONResponse({ modelType: User })
  public deleteUser(@Path("id") id: string, @Header("Session-Id") sessionId: string): Call<User> {
    return PASS;
  }

  @Headers({
    "Content-Type": "application/json",
  })
  @GET("feeds/users/{id}")
  @XMLResponse({ modelType: UserProfilePage })
  public getUserFeed(@Path("id") id: string): Call<UserProfilePage> {
    return PASS;
  }
}
