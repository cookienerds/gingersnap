import { Service } from "./Service";
import { ResponseType, ServiceInternalProps } from "./types";
import R from "ramda";
import CallExecutionError from "../../errors/CallExecutionError";
import { v4 as uuid } from "uuid";
import { Model } from "../model";
import { Stream } from "./Stream";

export class WebSocketService extends Service {
  private socket?: WebSocket;
  private readonly writeQueue: Map<string, [(v?: any) => void, (v?: any) => void, any]>;
  private readonly readQueue: Map<string, [(v?: any) => void, (v?: any) => void, any, string | RegExp]>;

  constructor(...args: any[]) {
    super(...args);
    this.writeQueue = new Map();
    this.readQueue = new Map();
  }

  protected onceConnectionClosed() {}

  shutdown() {
    this.socket?.close();
    this.socket = undefined;
    this.writeQueue.clear();
    this.readQueue.clear();
  }

  protected __setup__(): void {
    const internals: ServiceInternalProps = (this as any).__internal__;
    const socketMethods = R.filter(
      ([_, v]) => (v.socketReadStream ?? v.socketWriteStream) !== undefined,
      R.toPairs(internals.methodConfig)
    );
    const parentService = Object.getPrototypeOf(Object.getPrototypeOf(this));
    R.forEach(([key, config]) => {
      const oldMethod = this[key];
      this[key] = (...args: any[]) => {
        const { body } = parentService.__constructor_call_args__(new URL(this.baseUrl), {}, config, args);

        return new Stream(
          async (signal) => {
            if (config.socketWriteStream) {
              if (body === undefined) throw new CallExecutionError("Empty body detected for a write stream");
              return await this.__dispatch_data__(body, signal);
            } else if (config.socketReadStream)
              return await this.__read_data__(config.socketReadStream.keyPath, config.socketReadStream.value, signal);
            throw new CallExecutionError("Unsupported stream");
          },
          oldMethod,
          config.responseClass,
          config.throttle,
          config.socketWriteStream ? ResponseType.NONE : config.responseType,
          config.responseArray === true
        );
      };
    }, socketMethods);

    const originalMethodConfig = internals.methodConfig;
    internals.methodConfig = R.fromPairs(
      R.filter(([_, v]) => !(v.socketReadStream && v.socketWriteStream), R.toPairs(internals.methodConfig))
    );
    parentService.__setup__();
    internals.methodConfig = originalMethodConfig;
    this.__setup_socket_connection__();
  }

  private __setup_socket_connection__() {
    this.socket = new WebSocket(this.baseUrl);
    this.socket.onmessage = this.__process_message__.bind(this);
    this.socket.onopen = () => {
      for (const guid of this.writeQueue.keys()) {
        const value = this.writeQueue.get(guid);
        if (!value) continue;
        const [callback, , data] = value;
        this.socket?.send(data);
        this.writeQueue.delete(guid);
        callback();
      }
    };
    this.socket.onerror = (evt) => {
      console.warn("Websocket error: ", evt);
      console.warn("Attempting to reconnect...");
      this.__setup_socket_connection__();
    };
    this.socket.onclose = this.onceConnectionClosed.bind(this);
  }

  private async __dispatch_data__(data: any, signal: AbortSignal): Promise<any> {
    let payload: string | Blob | ArrayBuffer;
    if (data instanceof Model) {
      payload = data.json();
    } else if (data instanceof Blob || data instanceof ArrayBuffer || typeof data === "string") {
      payload = data;
    } else if (data instanceof Array) {
      payload = JSON.stringify(data.map((v) => (v instanceof Model ? v.object() : v)));
    } else {
      payload = JSON.stringify(data);
    }

    if (this.socket?.readyState === WebSocket.OPEN) return this.socket?.send(payload);

    return await new Promise((resolve, reject) => {
      const guid = uuid();
      signal.onabort = () => {
        if (this.writeQueue.has(guid)) {
          this.writeQueue.delete(guid);
          reject(new CallExecutionError("Abort"));
        }
      };
      this.writeQueue.set(guid, [resolve, reject, data]);
    });
  }

  private async __read_data__(
    keyPath: string | Array<string | number>,
    value: string | RegExp,
    signal: AbortSignal
  ): Promise<any> {
    return await new Promise<any>((resolve, reject) => {
      const guid = uuid();
      signal.onabort = () => {
        if (this.readQueue.has(guid)) {
          this.readQueue.delete(guid);
          reject(new CallExecutionError("Abort"));
        }
      };
      this.readQueue.set(guid, [resolve, reject, keyPath, value]);
    }).then((data) => new Response(data));
  }

  private __process_message__(evt: MessageEvent) {
    const data = evt.data;
    for (const guid of this.readQueue.keys()) {
      const value = this.readQueue.get(guid);
      if (!value) continue;

      const [resolve, , keyPath, keyValue] = value;
      const matcher = R.match(keyValue instanceof RegExp ? keyValue : new RegExp(keyValue));
      const lens = keyPath instanceof Array ? R.lensPath(keyPath) : R.lensProp<any>(keyPath);
      if (matcher(R.view<any, string>(lens, data)).length > 0) {
        this.readQueue.delete(guid);
        resolve(data);
      }
    }
  }
}
