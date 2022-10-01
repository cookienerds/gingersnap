import { BodyType, MapOfHeaders, ResponseType, ServiceInternalProps, ThrottleByProps } from "../types";
import * as R from "ramda";
import "reflect-metadata";

/// //// Constants ///////
const THROTTLE_DEFAULT_MS = 3000;
const SUPPORTED_HEADER_VALUES = ["String", "Number", "Boolean"];

/// //// Helpers ///////
export const createProps = (constructor: any) => {
  const proto: { __internal__: ServiceInternalProps } = constructor.prototype;
  if (proto.__internal__ === undefined) {
    proto.__internal__ = { classConfig: {}, methodConfig: {} };
  }
  return proto;
};

const createResponseDecorator =
  (type: ResponseType) =>
  (modelType: any = String, array = false) =>
  (target: any, propertyKey: string) => {
    const proto = createProps(target.constructor);
    const lens = R.lensPath(["methodConfig", propertyKey, "responseType"]);
    const typeLens = R.lensPath(["methodConfig", propertyKey, "responseClass"]);
    const isArrayLens = R.lensPath(["methodConfig", propertyKey, "responseArray"]);
    proto.__internal__ = R.set(lens, type, proto.__internal__);
    proto.__internal__ = R.set(typeLens, modelType, proto.__internal__);
    proto.__internal__ = R.set(isArrayLens, array, proto.__internal__);
  };

const createRequestBodyDecorator = (type: BodyType) => (target: any, propertyKey: string, parameterIndex: number) => {
  const proto = createProps(target.constructor);
  const lens = R.lensPath(["methodConfig", propertyKey, "parameters", "body"]);
  proto.__internal__ = R.set(lens, { type, parameterIndex }, proto.__internal__);
};

const createRequestMultiBodyDecorator = (type: BodyType) => (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const lens = R.lensPath(["methodConfig", propertyKey, "parameters", "body"]);
  const changer = R.compose(R.mergeDeepLeft({ type }), R.or<any, any>(R.__, {}));
  proto.__internal__ = R.over(lens, changer, proto.__internal__);
};

const createRequestMultiBodyParameterDecorator =
  (key: string) => (value: string) => (target: any, propertyKey: string, parameterIndex: number) => {
    const proto = createProps(target.constructor);
    const lens = R.lensPath(["methodConfig", propertyKey, "parameters", "body", key]);
    const changer = R.compose(R.mergeDeepLeft({ [value]: parameterIndex }), R.or<any, any>(R.__, {}));
    proto.__internal__ = R.over(lens, changer, proto.__internal__);
  };

/// //// Class Decorators ///////
export const BaseUrl = (value: string) => (constructor: any) => {
  const proto = createProps(constructor);
  proto.__internal__.classConfig.baseUrl = value;
};

/// //// Method Decorators ///////
export const JSONResponse = createResponseDecorator(ResponseType.JSON);

export const XMLResponse = createResponseDecorator(ResponseType.XML);

export const StringResponse = createResponseDecorator(ResponseType.STRING)(String);

export const BinaryResponse = createResponseDecorator(ResponseType.BINARY)(Blob);

export const NoResponse = createResponseDecorator(ResponseType.NONE)();

export const Multipart = createRequestMultiBodyDecorator(BodyType.MULTIPART);

export const FormUrlEncoded = createRequestMultiBodyDecorator(BodyType.FORMURLENCODED);

export const Headers = (value: MapOfHeaders) => (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const lens = R.lensPath(["methodConfig", propertyKey, "headers"]);
  const changer = R.compose(R.mergeDeepLeft(value), R.or<any, any>(R.__, {}));
  proto.__internal__ = R.over(lens, changer, proto.__internal__);
};

export const Throttle = (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const lens = R.lensPath(["methodConfig", propertyKey, "throttle"]);
  proto.__internal__ = R.set(lens, { waitPeriodInMs: THROTTLE_DEFAULT_MS }, proto.__internal__);
};

export const ThrottleBy = (value: ThrottleByProps) => (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const lens = R.lensPath(["methodConfig", propertyKey, "throttle"]);
  proto.__internal__ = R.set(lens, value, proto.__internal__);
};

export const Authenticator =
  <T>(type: T, global = false) =>
  (target: any, propertyKey: string) => {
    const proto = createProps(target.constructor);
    const lens = R.lensPath(["methodConfig", propertyKey, "authenticator"]);
    proto.__internal__ = R.set(lens, { type, global }, proto.__internal__);
  };

export const AuthRefresher =
  <T>(type: T, global = false) =>
  (target: any, propertyKey: string) => {
    const proto = createProps(target.constructor);
    const lens = R.lensPath(["methodConfig", propertyKey, "authRefresher"]);
    proto.__internal__ = R.set(lens, { type, global }, proto.__internal__);
  };

/// //// Parameter Decorators ///////
export const Part = createRequestMultiBodyParameterDecorator("parts");

export const Field = createRequestMultiBodyParameterDecorator("fields");

export const JSONBody = createRequestBodyDecorator(BodyType.JSON);

export const XMLBody = createRequestBodyDecorator(BodyType.XML);

export const StringBody = createRequestBodyDecorator(BodyType.STRING);

export const QueryMap = (target: any, propertyKey: string, parameterIndex: number) => {
  const proto = createProps(target.constructor);
  const lens = R.lensPath(["methodConfig", propertyKey, "parameters", "queries"]);
  proto.__internal__ = R.over(
    lens,
    R.compose(R.mergeLeft<any, any>({ [Symbol(propertyKey)]: parameterIndex }, R.__), R.or<any, any>(R.__, {})),
    proto.__internal__
  );
};

export const Path = (value: string) => {
  return (target: any, propertyKey: string, parameterIndex: number) => {
    const type: string = R.path(
      [parameterIndex, "name"],
      Reflect.getMetadata("design:paramtypes", target, propertyKey)
    )!;
    if (!["String", "Number"].includes(type)) {
      throw Error("Invalid type given for @Query. Should be of type string or number");
    }
    const proto = createProps(target.constructor);
    const lens = R.lensPath(["methodConfig", propertyKey, "parameters", "pathVariables"]);
    proto.__internal__ = R.over(
      lens,
      R.compose(R.mergeDeepWith(R.concat, { [value]: parameterIndex }), R.or<any, any>(R.__, {})),
      proto.__internal__
    );
  };
};

export const Query = (value: string) => {
  return (target: any, propertyKey: string, parameterIndex: number) => {
    const type: string = R.path(
      [parameterIndex, "name"],
      Reflect.getMetadata("design:paramtypes", target, propertyKey)
    )!;
    if (type !== "String") {
      throw Error("Invalid type given for @Query. Should be of type string");
    }
    const proto = createProps(target.constructor);
    const lens = R.lensPath(["methodConfig", propertyKey, "parameters", "queries"]);
    proto.__internal__ = R.over(
      lens,
      R.compose(R.mergeDeepWith(R.concat, { [value]: parameterIndex }), R.or<any, any>(R.__, {})),
      proto.__internal__
    );
  };
};

export const Header = (value: string) => {
  return (target: any, propertyKey: string, parameterIndex: number) => {
    const type: string = R.path(
      [parameterIndex, "name"],
      Reflect.getMetadata("design:paramtypes", target, propertyKey)
    )!;
    if (!SUPPORTED_HEADER_VALUES.includes(type)) {
      throw Error("Invalid type given for @HeaderMap. Should be of type string, number or boolean");
    }
    const proto = createProps(target.constructor);
    const lens = R.lensPath(["methodConfig", propertyKey, "parameters", "headers"]);
    proto.__internal__ = R.over(
      lens,
      R.compose(R.mergeDeepWith(R.concat, { [value]: parameterIndex }), R.or<any, any>(R.__, {})),
      proto.__internal__
    );
  };
};

export const HeaderMap = (target: any, propertyKey: string, parameterIndex: number) => {
  const proto = createProps(target.constructor);
  const lens = R.lensPath(["methodConfig", propertyKey, "parameters", "headers"]);
  const key = Symbol(propertyKey);
  proto.__internal__ = R.over(
    lens,
    R.compose(R.mergeLeft<any, any>({ [key]: parameterIndex }, R.__), R.or<any, any>(R.__, {})),
    proto.__internal__
  );
};
