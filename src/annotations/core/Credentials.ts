import { MapOfHeaders } from "../utils/types";
import { Field, Model } from "./Model";

export abstract class Credentials extends Model {
  abstract buildAuthHeaders(): MapOfHeaders;

  public buildRefreshHeaders(): MapOfHeaders {
    return {};
  }
}

export class BearerCredentials extends Credentials {
  @Field() accessToken: string;
  @Field() refreshToken?: string;

  constructor(accessToken: string, refreshToken?: string) {
    super();
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  public buildAuthHeaders(): MapOfHeaders {
    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  public buildRefreshHeaders(): MapOfHeaders {
    return {
      access_token: this.accessToken,
      refresh_token: this.refreshToken ?? "",
    };
  }
}

export class APIKeyCredentials extends Credentials {
  @Field() apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  public buildAuthHeaders(): MapOfHeaders {
    return {
      "X-API-Key": this.apiKey,
    };
  }
}

export class BasicCredentials extends Credentials {
  @Field() username: string;
  @Field() password: string;

  constructor(username: string, password: string) {
    super();
    this.username = username;
    this.password = password;
  }

  public buildAuthHeaders(): MapOfHeaders {
    const token = btoa(`${this.username}:${this.password}`);
    return {
      Authorization: `Basic ${token}`,
    };
  }
}
