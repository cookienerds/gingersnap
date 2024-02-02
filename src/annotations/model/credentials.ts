import { Model } from "./model";
import { MapOfHeaders } from "../service/types";
import { Alias, Field, Ignore } from "./property";
import { isNode } from "browser-or-node";

/**
 * Class that represents credentials used for sending authorized requests
 */
export abstract class Credentials extends Model {
  /**
   * Abstract method for constructing the authentication headers used in a request
   */
  abstract buildAuthHeaders(): MapOfHeaders;

  /**
   * Method for constructing the refresh headers used in a request to retrieve new credentials
   */
  public buildRefreshHeaders(): MapOfHeaders {
    return {};
  }
}

/**
 * Credentials that support JWT
 */
export class BearerCredentials extends Credentials {
  /**
   * JWT access token use for authenticated requests
   */
  @Alias("access_token")
  @Field("accessToken")
  accessToken: string;

  /**
   * JWT refresh token used to retrieve new access token
   */
  @Alias("refresh_token")
  @Field("refreshToken")
  refreshToken?: string;

  /**
   * Expiration date
   */
  @Ignore()
  @Alias("expirationDate")
  @Alias("expiration_date")
  @Alias("expiryDate")
  @Alias("exp")
  @Field("expiry_date")
  expirationDate?: Date;

  constructor(accessToken: string, refreshToken?: string, expirationDate?: Date) {
    super();
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expirationDate = expirationDate;
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

/**
 * Credentials for using API service
 */
export class APIKeyCredentials extends Credentials {
  /**
   * API Key used for authenticated requests
   */
  @Alias("api_key")
  @Field("apiKey")
  apiKey: string;

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

/**
 * Credentials that is used for username and password authenticated requests
 */
export class BasicCredentials extends Credentials {
  /**
   * Username for the authenticated user
   */
  @Field("username")
  username: string;

  /**
   * Password for the authenticated user
   */
  @Field("password")
  password: string;

  constructor(username: string, password: string) {
    super();
    this.username = username;
    this.password = password;
  }

  public buildAuthHeaders(): MapOfHeaders {
    let token: string;

    if (isNode) {
      token = Buffer.from(`${this.username}:${this.password}`).toString("base64");
    } else {
      token = btoa(`${this.username}:${this.password}`);
    }
    return {
      Authorization: `Basic ${token}`,
    };
  }
}
