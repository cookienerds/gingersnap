import { Service } from "./service";
import { BrowserWebSocket } from "../../utils/socket";
import { ServiceInternalProps } from "./types";
import * as R from "ramda";
import CallExecutionError from "../../errors/CallExecutionError";
import { Stream } from "../../utils/stream";
import ParsingError from "../../errors/ParsingError";
import { DataFormat, Model } from "../model";
import { FutureResult } from "../../utils/future";

export class WebSocketService extends Service {
  private readonly socket: BrowserWebSocket;

  constructor(...args: any[]) {
    super(...args);
    this.socket = new BrowserWebSocket(this.baseUrl);
  }

  /**
   * Called when socket connection is closed
   * @protected
   */
  protected onceConnectionClosed() {}

  /**
   * Shutdown the socket connection
   */
  async shutdown() {
    this.socket.close();
    this.onceConnectionClosed();
    await this.socket.awaitClosed();
  }

  async ready() {
    return await this.socket.open();
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
      const details = internals.methodConfig[key]?.socketReadStream;
      let dataComparator = (v: any) => false;

      if (config.socketReadStream) {
        if (!details) throw new ParsingError([], "ReadStreamDetailsMissing");
        if (!config.responseClass) throw new ParsingError([], "ResponseTypeMissing");
        dataComparator = R.compose(
          typeof details.value === "string" ? R.equals(new String(details.value)) : details.value.test,
          R.view(
            typeof details.keyPath === "string" ? R.lensProp<any, any>(details.keyPath) : R.lensPath(details.keyPath)
          )
        );
      }

      this[key] = (body?: any) => {
        if (config.socketWriteStream) {
          if (body === undefined || body === null)
            throw new CallExecutionError("Empty body detected for a write stream");
          return new Stream(async (signal) => {
            await this.socket.open();
            if (body instanceof Model) {
              this.socket.send(body.blob());
            } else if (body instanceof ArrayBuffer || body instanceof Blob) {
              this.socket.send(body);
            } else {
              this.socket.send(JSON.stringify(body));
            }
            const result = oldMethod();
            if (result instanceof Promise) {
              await result;
            }
          });
        } else {
          return this.socket.stream
            .map((data) => (config.responseClass as typeof Model).fromBlob(data, config.dataFormat ?? DataFormat.JSON))
            .flatten()
            .filter(dataComparator)
            .map(async (v) => {
              let result = oldMethod(v);
              if (result === null || result === undefined) return v;
              if (result instanceof Promise) result = await result;
              if (result instanceof FutureResult) result = result.value;

              return result;
            });
        }
      };
    }, socketMethods);

    void this.socket.open();

    const originalMethodConfig = internals.methodConfig;
    internals.methodConfig = R.fromPairs(
      R.filter(([_, v]) => !(v.socketReadStream && v.socketWriteStream), R.toPairs(internals.methodConfig))
    );
    super.__setup__();
    internals.methodConfig = originalMethodConfig;
  }
}
