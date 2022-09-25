import * as R from "ramda";
import { createProps } from "./options";
import { RequestType } from "../types";

/// //// Helpers ///////
const createRequestDecorator = (type: RequestType) => (path: string) => (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const typeLens = R.lensPath(["methodConfig", propertyKey, "requestType"]);
  const pathLens = R.lensPath(["methodConfig", propertyKey, "apiPath"]);
  proto.__internal__ = R.set(typeLens, type, proto.__internal__);
  proto.__internal__ = R.set(pathLens, path, proto.__internal__);
};

/// //// Method Decorators ///////
export const GET = createRequestDecorator(RequestType.GET);

export const PUT = createRequestDecorator(RequestType.PUT);

export const POST = createRequestDecorator(RequestType.POST);

export const DELETE = createRequestDecorator(RequestType.DELETE);

export const PATCH = createRequestDecorator(RequestType.PATCH);

export const OPTIONS = createRequestDecorator(RequestType.OPTIONS);

export const HEAD = createRequestDecorator(RequestType.HEAD);
