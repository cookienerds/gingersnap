import { createProps } from "./options";
import * as R from "ramda";

export const ReadStream =
  (keyPath: string | Array<string | number>, value?: string | number | boolean | RegExp) =>
  (target: any, propertyKey: string) => {
    if (keyPath !== "*" && (value === undefined || value === null))
      throw new Error("KeyPath requires a value, unless keyPath is *");

    const proto = createProps(target.constructor);
    const typeLens = R.lensPath(["methodConfig", propertyKey, "socketReadStream"]);
    proto.__internal__ = R.set(
      typeLens,
      {
        keyPath,
        value,
        model: Reflect.getMetadata("design:paramtypes", target, propertyKey)[0],
        array: false,
      },
      proto.__internal__
    );
  };

export const WriteStream = (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const typeLens = R.lensPath(["methodConfig", propertyKey, "socketWriteStream"]);
  proto.__internal__ = R.set(typeLens, true, proto.__internal__);
};
