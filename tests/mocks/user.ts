import {
  DELETE,
  GET,
  Header,
  HeaderMap,
  Headers,
  JSONBody,
  JSONResponse,
  PASS,
  Path,
  POST,
  PUT,
  Query,
  QueryMap,
  Service,
  Throttle,
  ThrottleBy,
  XMLResponse,
} from "../../src/annotations/service";
import { ArrayField, Field, Ignore, MapField, Model } from "../../src/annotations/model";
import "reflect-metadata";
import { Call } from "../../src/utils";

export class User extends Model {
  @Field() name!: string;
  @ArrayField(User) friends!: User[];
  @Field("contact_no") tel!: string;
  @Field("timestamp") createdOn!: Date;

  @Ignore()
  @Field()
  bestie?: User;

  @Ignore()
  @MapField(String, User)
  friendsConnection!: Map<string, User>;

  updatedAt!: Date;
  private ref!: number;

  @Field("updatedAt")
  private computeLastUpdate(value: string): void {
    this.updatedAt = new Date(value);
  }

  // eslint-disable-next-line accessor-pairs
  @Field()
  private set totalReferences(value: number) {
    this.ref = Number(value);
  }

  @Field("totalReferences")
  get references() {
    return this.ref;
  }

  @Field("updatedAt")
  private get updatedAtGetter() {
    return this.updatedAt;
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
