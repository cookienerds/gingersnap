import { Model } from "./model";
import { MapOfHeaders } from "../service";
import { Field } from "./property";

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
  @Field()
  accessToken: string;

  /**
   * JWT refresh token used to retrieve new access token
   */
  @Field()
  refreshToken?: string;

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

/**
 * Credentials for using API service
 */
export class APIKeyCredentials extends Credentials {
  /**
   * API Key used for authenticated requests
   */
  @Field()
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
  @Field()
  username: string;

  /**
   * Password for the authenticated user
   */
  @Field()
  password: string;

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
