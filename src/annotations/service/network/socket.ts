import { createProps } from "./options";
import * as R from "ramda";

export const ReadStream =
  (
    keyPath: string | Array<string | number> | { [string: string]: string },
    value?: string | number | boolean | RegExp
  ) =>
  (target: any, propertyKey: string) => {
    if (keyPath !== "*" && (value === undefined || value === null))
      throw new Error("KeyPath requires a value, unless keyPath is *");

    const proto = createProps(target.constructor);
    const typeLens = R.lensPath(["methodConfig", propertyKey, "socketReadStream"]);
    proto.__internal__ = R.over(
      typeLens,
      (v) => ({
        ...(v ?? {}),
        keyPath,
        value,
        model: Reflect.getMetadata("design:paramtypes", target, propertyKey)[0],
        array: false,
      }),
      proto.__internal__
    );
  };

export const MatcherKey = (name: string) => (target: any, propertyKey: string, parameterIndex: number) => {};
export const MatcherValue = (name: string) => (target: any, propertyKey: string, parameterIndex: number) => {};

export const WriteStream = (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const typeLens = R.lensPath(["methodConfig", propertyKey, "socketWriteStream"]);
  proto.__internal__ = R.set(typeLens, true, proto.__internal__);
};

export const ReplyableStream =
  (keyPath: string | Array<string | number>, responseKeyPath?: string | Array<string | number>) =>
  (target: any, propertyKey: string) => {
    const proto = createProps(target.constructor);
    const typeLens = R.lensPath(["methodConfig", propertyKey, "socketReadStream"]);
    // proto.__internal__ = R.over(
    //   typeLens,
    //   (v) => ({
    //     ...(v ?? {}),
    //     keyPath,
    //     value,
    //     model: Reflect.getMetadata("design:paramtypes", target, propertyKey)[0],
    //     array: false,
    //   }),
    //   proto.__internal__
    // );
  };

export const IgnoreCache = (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const typeLens = R.lensPath(["methodConfig", propertyKey, "socketReadStream"]);
  proto.__internal__ = R.over(
    typeLens,
    (v) => ({
      ...(v ?? {}),
      ignoreCache: true,
    }),
    proto.__internal__
  );
};

export const Skip = (amount: number) => (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const typeLens = R.lensPath(["methodConfig", propertyKey, "socketReadStream"]);
  proto.__internal__ = R.over(
    typeLens,
    (v) => ({
      ...(v ?? {}),
      skip: amount,
    }),
    proto.__internal__
  );
};

export const Take = (amount: number) => (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const typeLens = R.lensPath(["methodConfig", propertyKey, "socketReadStream"]);
  proto.__internal__ = R.over(
    typeLens,
    (v) => ({
      ...(v ?? {}),
      take: amount,
    }),
    proto.__internal__
  );
};

// Decoder must return an object
export const DataDecoder = (Decoder: any) => (constructor: any) => {
  const proto = createProps(constructor);
  const typeLens = R.lensPath(["classConfig", "Decoder"]);
  proto.__internal__ = R.set(typeLens, Decoder, proto.__internal__);
};
