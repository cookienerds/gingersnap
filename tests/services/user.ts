import { Service } from "../../src/annotations/core/Service";
import { DELETE, GET, POST, PUT } from "../../src/annotations/utils/network/requests";
import { Call } from "../../src/annotations/core/Call";
import {
  Path,
  Headers,
  Header,
  Query,
  QueryMap,
  JSONResponse,
  XMLResponse,
  HeaderMap,
  Throttle,
  ThrottleBy,
  JSONBody,
} from "../../src/annotations/utils/network/options";
import { ArrayField, Field, Ignore, Model } from "../../src/annotations/core/Model";
import { PASS } from "../../src/annotations/utils/types";
import "reflect-metadata";

export class User extends Model {
  @Field() name!: String;
  @ArrayField(User) friends!: User[];
  @Field("contact_no") tel!: String;
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
  @JSONResponse(User, true)
  public getUsers(): Call<User[]> {
    return PASS;
  }

  @GET("users/{id}")
  @JSONResponse(User)
  public getUser(@Path("id") id: string): Call<User> {
    return PASS;
  }

  @GET("users")
  @JSONResponse(User)
  @Throttle
  public getUserByName(@Query("name") name: string): Call<User> {
    return PASS;
  }

  @GET("users?tel=1234567")
  @JSONResponse(User)
  @ThrottleBy({ waitPeriodInMs: 1000 })
  public getUserByTel(@Query("contact_no") tel: string): Call<User> {
    return PASS;
  }

  @GET("users")
  @JSONResponse(User)
  public getUserByProperties(@QueryMap properties: { [string: string]: string }): Call<User> {
    return PASS;
  }

  @JSONResponse(User)
  @POST("users")
  public createUser(@JSONBody user: User): Call<User> {
    return PASS;
  }

  @PUT("users/{id}")
  @JSONResponse(User)
  public updateUser(
    @JSONBody user: User,
    @Path("id") id: string,
    @HeaderMap headers: { [string: string]: string }
  ): Call<User> {
    return PASS;
  }

  @DELETE("users/{id}")
  @JSONResponse(User)
  public deleteUser(@Path("id") id: string, @Header("Session-Id") sessionId: string): Call<User> {
    return PASS;
  }

  @Headers({
    "Content-Type": "application/json",
  })
  @GET("feeds/users/{id}")
  @XMLResponse(UserProfilePage)
  public getUserFeed(@Path("id") id: string): Call<UserProfilePage> {
    return PASS;
  }
}
