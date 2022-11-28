import { createProps } from "./options";
import * as R from "ramda";

const ReadStream =
  (keyPath: string | Array<string | number>, value: string | RegExp) => (target: any, propertyKey: string) => {
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

const WriteStream = (target: any, propertyKey: string) => {
  const proto = createProps(target.constructor);
  const typeLens = R.lensPath(["methodConfig", propertyKey, "socketWriteStream"]);
  proto.__internal__ = R.set(typeLens, true, proto.__internal__);
};
