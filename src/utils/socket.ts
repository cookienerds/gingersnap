import NetworkError from "../errors/NetworkError";
import { HTTPStatus, ResponseType } from "../annotations/service";
import { Stream } from "./stream";
import { Queue } from "./object/Queue";
import { wait } from "./timer";

type SocketFunctor<T extends CloseEvent | Event | MessageEvent> = (this: WebSocket, evt: T) => any;

interface WebSocketConfiguration {
  retryOnDisconnect?: boolean;
  cacheSize?: number;
  cacheExpiryMs?: number;
  exponentialFactor?: number;
  backoffPeriodMs?: number;
}

/**
 * Promise based web sockets
 */
export class BrowserWebSocket<T extends Blob | ArrayBuffer = Blob> {
  private readonly retryOnDisconnect: boolean;
  private openPromise?: Promise<void>;
  private closePromise?: Promise<void>;

  private socketListeners: Array<[keyof WebSocketEventMap, SocketFunctor<any>]>;

  private closePromiseCallbacks!: [() => void, (reason?: any) => void];

  private readonly messageQueue: Queue<Response>;

  private readonly url: string;
  private socket?: WebSocket;

  private manuallyClosed: boolean;

  private readonly cacheSize: number;

  private readonly backoffPeriodMs: number;

  private readonly exponentialFactor: number;

  private backoffPeriods: number;

  binaryType: "blob" | "arraybuffer";

  constructor(
    url: string,
    { retryOnDisconnect, cacheSize, cacheExpiryMs, exponentialFactor, backoffPeriodMs }: WebSocketConfiguration = {}
  ) {
    this.socketListeners = [];
    this.url = url;
    this.cacheSize = cacheSize ?? 10000;
    this.manuallyClosed = false;
    this.binaryType = "blob";
    this.retryOnDisconnect = retryOnDisconnect ?? true;
    this.exponentialFactor = exponentialFactor ?? 2;
    this.backoffPeriodMs = backoffPeriodMs ?? 10;
    this.backoffPeriods = -1;
    this.messageQueue = new Queue<Response>(this.cacheSize, cacheExpiryMs ?? 60000);
  }

  get opened() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  get closed() {
    return this.socket && this.socket.readyState === WebSocket.CLOSED;
  }

  /**
   * opens the current web socket connection
   */
  async open() {
    if (!this.openPromise) {
      this.closePromise = new Promise((resolve, reject) => {
        this.closePromiseCallbacks = [resolve, reject];
      });
      this.openPromise = new Promise<void>((resolve, reject) => {
        let retrying = false;
        const cancelError = this.addEventListener("error", async () => {
          if (this.retryOnDisconnect) {
            retrying = true;
            this.getSocket()?.close();
            await wait({
              milliseconds: this.backoffPeriodMs * Math.pow(this.exponentialFactor, ++this.backoffPeriods),
            });
            this.createSocket();
          } else {
            retrying = false;
            cancelError();
            cancelOpen();
            reject(new NetworkError(HTTPStatus.EXPECTATION_FAILED));
            this.getSocket()?.close();
          }
        });
        const cancelOpen = this.addEventListener("open", () => {
          this.backoffPeriods = -1;
          retrying = false;
          resolve();
          cancelError();
          cancelOpen();
        });
        const cancelClose = this.addEventListener("close", () => {
          if (retrying) return;
          if (!this.manuallyClosed && this.retryOnDisconnect) {
            delete this.openPromise;
            cancelError();
            cancelOpen();
            cancelClose();
            this.open().then(resolve).catch(reject);
          } else {
            retrying = false;
            this.closePromiseCallbacks[0]();
            cancelQueue();
            reject(new NetworkError(HTTPStatus.EXPECTATION_FAILED));
          }
        });
        const cancelQueue = this.addEventListener("message", (evt: MessageEvent) => {
          const data = evt.data;
          this.messageQueue.push(new Response(data));
        });
        this.createSocket();
      });
    }

    await this.openPromise;
  }

  /**
   * Wait for the socket connection closed.
   * @remark
   * This doesn't actually attempt to close the socket, only waits for the connection to close
   */
  async awaitClosed() {
    if (this.closePromise) return await this.closePromise;
  }

  /**
   * Closes the socket if currently open
   */
  close() {
    this.manuallyClosed = true;
    this.getSocket()?.close();
  }

  /**
   * Sends data via socket
   * @param data
   */
  send(data: string | ArrayBufferView | Blob | ArrayBufferLike) {
    this.getSocket()?.send(data);
  }

  /**
   * Gets the stream for messages received via this socket
   */
  get stream() {
    return new Stream<T>(
      async (signal) => {
        if (!this.closed) {
          const value: any = await Promise.race([this.messageQueue.awaitPop(signal), this.awaitClosed()]);
          if (value) return value;
        }
      },
      undefined,
      undefined,
      undefined,
      ResponseType.BINARY
    );
  }

  private addEventListener<T extends CloseEvent | Event | MessageEvent>(
    type: keyof WebSocketEventMap,
    functor: SocketFunctor<T>
  ) {
    this.socketListeners.push([type, functor]);
    if (this.socket) {
      this.socket.addEventListener(type, functor as any);
    }

    return () => {
      this.socketListeners = this.socketListeners.filter(([t, f]) => f !== functor && t !== type);
      if (this.socket) this.socket.removeEventListener(type, functor as any);
    };
  }

  private createSocket() {
    const socket = new WebSocket(this.url);
    socket.binaryType = this.binaryType;
    this.socketListeners.forEach(([type, functor]) => socket.addEventListener(type, functor));
    this.socket = socket;
    return socket;
  }

  private getSocket() {
    return this.socket;
  }
}
