import { AnyDataType } from "../types";
import { WaitableObject } from "./WaitableObject";

type GetListener = (property: string | Array<string | number> | number) => void;
type SetListener = (
  property: string | Array<string | number> | number,
  oldValue: AnyDataType,
  newValue: AnyDataType
) => void;
type DeleteListener = (property: string | Array<string | number> | number, oldValue: AnyDataType) => void;

export interface Configuration {
  entryThreshold: number;
}

export enum WatchableObjectOperations {
  DELETE,
  GET,
  SET,
}

export class WatchableObject extends WaitableObject {
  private getListeners: GetListener[];
  private setListeners: SetListener[];
  private deleteListeners: DeleteListener[];
  protected readonly proxyObj: Map<any, any>;

  constructor(objectMaxSize?: number, expiryMs?: number) {
    super(objectMaxSize, expiryMs);
    this.getListeners = [];
    this.setListeners = [];
    this.deleteListeners = [];
    let self = this;
    const classProperties = new Set<string>();

    while (self) {
      const props = Object.getOwnPropertyNames(self);
      props.forEach((v) => classProperties.add(v));
      self = Object.getPrototypeOf(self);
    }
    self = this;
    Object.getOwnPropertyNames(self).forEach((v) => {
      if (self[v] instanceof Function) {
        self[v] = self[v].bind(self);
      }
    });

    this.proxyObj = new Proxy(this.targetObject, {
      get: (target: Map<any, any>, p: string | symbol, receiver: any) => {
        if (typeof p !== "symbol" && !classProperties.has(p)) {
          setTimeout(() => self.getListeners.forEach((listener) => listener(p)), 1);
          return self.get(p);
        }
        return Reflect.get(self, p, receiver);
      },
      set: (target: Map<any, any>, p: string, value: any, receiver: any) => {
        const oldValue = self.get(p);
        self.set(p, value);
        self.setListeners.forEach((listener) => listener(p, oldValue, value));
        return true;
      },
      deleteProperty: (target: Map<any, any>, p: string) => {
        const value = self.get(p);
        if (value !== undefined) {
          self.delete(p);
          self.deleteListeners.forEach((listener) => listener(p, value));
        }

        return true;
      },
    });

    return this.proxyObj as any;
  }

  onGet(listener: GetListener) {
    this.getListeners.push(listener);
    return () => {
      this.getListeners = this.getListeners.filter((v) => v !== listener);
    };
  }

  onSet(listener: SetListener) {
    this.setListeners.push(listener);
    return () => {
      this.setListeners = this.setListeners.filter((v) => v !== listener);
    };
  }

  onDelete(listener: DeleteListener) {
    this.deleteListeners.push(listener);
    return () => {
      this.deleteListeners = this.deleteListeners.filter((v) => v !== listener);
    };
  }

  get(key: string | Array<string | number> | number): AnyDataType {
    setTimeout(() => this.getListeners.forEach((listener) => listener(key)), 1);
    return super.get(key);
  }

  set(key: string | Array<string | number> | number, value: AnyDataType, expiryMs?: number) {
    const oldValue = this.get(key);
    super.set(key, value, expiryMs);
    this.setListeners.forEach((listener) => listener(key, oldValue, value));
  }

  delete(key: string | Array<string | number> | number) {
    const oldValue = this.get(key);
    super.delete(key);
    if (oldValue !== undefined) this.deleteListeners.forEach((listener) => listener(key, oldValue));
  }

  clear() {
    const oldValue = this.targetObject;
    setTimeout(() => this.deleteListeners.forEach((listener) => listener([], oldValue)), 1);
    super.clear();
  }

  async await(key: string | string[] | number | number[], abort?: AbortSignal): Promise<AnyDataType> {
    return await super.await(key, abort).then((value) => {
      setTimeout(() => this.getListeners.forEach((listener) => listener(key)), 1);
      return value;
    });
  }

  on(key: string | string[], callback: (value: AnyDataType) => void): () => void {
    return super.on(key, (v) => {
      setTimeout(() => this.getListeners.forEach((listener) => listener(key)), 1);
      callback(v);
    });
  }

  values(copy?: boolean) {
    setTimeout(() => this.getListeners.forEach((listener) => listener([])), 1);
    return super.values(copy);
  }
}
