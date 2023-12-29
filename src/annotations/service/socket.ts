import { Service } from "./service";
import { StreamableWebSocket } from "../../utils/socket";
import { ServiceInternalProps } from "./types";
import * as R from "ramda";
import CallExecutionError from "../../errors/CallExecutionError";
import { Stream } from "../../utils/stream";
import ParsingError from "../../errors/ParsingError";
import { FutureResult } from "../../utils/future";
import { JSONDecoder } from "../../utils/decoders/json";
import { Model } from "../model";
import { GingerSnapProps } from "../index";

export class WebSocketService extends Service {
  private readonly socket: StreamableWebSocket<any>;

  constructor({ decoder, ...other }: GingerSnapProps = {}) {
    super(other ?? {});
    const internals: ServiceInternalProps = (this as any).__internal__;
    this.socket = new StreamableWebSocket(
      this.baseUrl,
      decoder ?? (internals.classConfig.Decoder ? new internals.classConfig.Decoder() : new JSONDecoder())
    );
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
    await this.socket.closedFuture();
  }

  ready() {
    return this.socket.open();
  }

  protected __setup__(): void {
    const internals: ServiceInternalProps = (this as any).__internal__;
    if (this.socket.decoder.load) {
      this.socket.decoder.load();
    }
    const socketMethods = R.filter(
      ([_, v]) => (v.socketReadStream ?? v.socketWriteStream) !== undefined,
      R.toPairs(internals.methodConfig)
    );
    R.forEach(([key, config]) => {
      const oldMethod = this[key];
      const details = internals.methodConfig[key]?.socketReadStream;
      let dataComparator = (v: any) => false;

      if (config.socketReadStream) {
        if (!details) throw new ParsingError([], "ReadStreamDetailsMissing");
        if (!config.responseClass) throw new ParsingError([], "ResponseTypeMissing");
        let equalsChecker: any;

        switch (typeof details.value) {
          case "boolean":
            equalsChecker = R.equals(Boolean(details.value));
            break;
          case "string":
            equalsChecker = R.equals(String(details.value));
            break;
          case "number":
            equalsChecker = R.equals(Number(details.value));
            break;
          default:
            if (details.value instanceof RegExp) equalsChecker = details.value.test;
            else equalsChecker = R.equals(details.value);
        }
        dataComparator = R.compose(
          (v) => equalsChecker(v),
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
            if (!this.socket.opened) {
              await this.socket.open();
            }

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
            return null;
          }).once();
        } else {
          let stream = this.socket.stream(config.socketReadStream?.ignoreCache ?? false).filter(dataComparator);
          if (config.socketReadStream?.skip !== undefined) stream = stream.skip(config.socketReadStream.skip);
          if (config.socketReadStream?.take !== undefined) stream = stream.take(config.socketReadStream.take);

          return stream
            .map((data) => {
              const ModelClass = config.responseClass as typeof Model;
              return ModelClass.fromJSON(data);
            })
            .flatten()
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

    if (!this.socket.opened) {
      void this.socket.open();
    }

    const originalMethodConfig = internals.methodConfig;
    internals.methodConfig = R.fromPairs(
      R.filter(([_, v]) => !(v.socketReadStream && v.socketWriteStream), R.toPairs(internals.methodConfig))
    );
    super.__setup__();
    internals.methodConfig = originalMethodConfig;
  }
}
