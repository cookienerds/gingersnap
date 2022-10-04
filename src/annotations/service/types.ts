import { Credentials } from "../Credentials";

export enum RequestType {
  GET = "GET",
  PUT = "PUT",
  POST = "POST",
  DELETE = "DELETE",
  PATCH = "PATCH",
  OPTIONS = "OPTIONS",
  HEAD = "HEAD",
}

export enum ResponseType {
  STRING = 1,
  XML,
  JSON,
  BINARY,
  NONE,
}

export enum BodyType {
  STRING = 1,
  XML,
  JSON,
  MULTIPART,
  FORMURLENCODED,
}

export interface ThrottleByProps {
  waitPeriodInMs?: number;
}

interface BodyProps<T extends BodyType> {
  type: T;
}

interface MultiPartBodyProps extends BodyProps<BodyType.MULTIPART> {
  parts: { [string: string]: number };
}

interface FormURLEncodedBodyProps extends BodyProps<BodyType.FORMURLENCODED> {
  fields?: { [string: string]: number };
  optionalFields?: { [string: string]: number };
}

interface StringBodyProps extends BodyProps<BodyType.STRING> {
  parameterIndex: number;
}

interface JSONBodyProps extends BodyProps<BodyType.JSON> {
  parameterIndex: number;
}

interface XMLBodyProps extends BodyProps<BodyType.XML> {
  parameterIndex: number;
}

export interface MethodConfiguration {
  authenticator?: {
    type: Credentials;
    global?: boolean;
  };
  authRefresher?: {
    type: Credentials;
    global?: boolean;
  };
  requestType?: RequestType;
  apiPath?: string;
  headers?: MapOfHeaders;
  responseType?: ResponseType;
  responseClass?: any;
  responseArray?: boolean;
  throttle?: ThrottleByProps;
  parameters?: {
    body?: MultiPartBodyProps | FormURLEncodedBodyProps | StringBodyProps | JSONBodyProps | XMLBodyProps;
    headers?: MapOfHeaders;
    queries?: MapOfQueries;
    pathVariables?: MapOfPath;
  };
}

export interface ServiceInternalProps {
  classConfig: {
    baseUrl?: string;
  };
  methodConfig: {
    [string: string]: MethodConfiguration;
  };
}

interface MapOf<T> {
  [string: string]: T;
}
export type MapOfHeaders = MapOf<string | string[]>;
export type ParamHeaders = MapOf<number>;
export type MapOfQueries = MapOf<number>;
export type MapOfPath = MapOf<number>;
export type NONE = null;
export const PASS = null as any;