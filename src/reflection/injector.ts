import "reflect-metadata";

export function Inject(target: any, name: string) {
  let value: any;
  const descriptor = {
    get(this: any) {
      if (value === undefined) {
        value = new (Reflect.getMetadata("design:type", target, name))();
      }
      return value;
    },
    set(val: any) {
      value = val;
    },
    enumerable: true,
    configurable: true,
  };

  Object.defineProperty(target, name, descriptor);
}

export function InjectWithArgs(...args: any[]) {
  return (target: any, name: string) => {
    let value: any;
    const descriptor = {
      get(this: any) {
        if (value === undefined) {
          value = new (Reflect.getMetadata("design:type", target, name))(...args);
        }
        return value;
      },
      set(val: any) {
        value = val;
      },
      enumerable: true,
      configurable: true,
    };

    Object.defineProperty(target, name, descriptor);
  };
}
