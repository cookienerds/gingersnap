import NetworkError from "../../errors/NetworkError";
import { HTTPStatus } from "../../annotations/service";
import { Stream } from "../stream";
import { Future, WaitPeriod } from "../future";
import { BufferQueue } from "../../data-structures/object";
import { ExecutorState } from "../state";
import { Decoder } from "../decoders/type";

type SocketFunctor<T extends CloseEvent | Event | MessageEvent> = (this: WebSocket, evt: T) => any;

interface WebSocketConfiguration {
  retryOnDisconnect?: boolean;
  cacheSize?: number;
  cacheExpiryPeriod?: WaitPeriod;
  exponentialFactor?: number;
  backoffPeriodMs?: number;
}

/**
 * Promise based web sockets
 */
export class StreamableWebSocket<T> {
  private readonly retryOnDisconnect: boolean;
  private openFuture?: Future<void>;
  private closeFuture?: Future<void>;

  private socketListeners: Array<[keyof WebSocketEventMap, SocketFunctor<any>]>;

  private closeFutureCallbacks!: [() => void, (reason?: any) => void, AbortSignal];

  private readonly messageQueue: BufferQueue<T>;

  private readonly url: string;
  private socket?: WebSocket;

  private manuallyClosed: boolean;

  private readonly cacheSize: number;

  private readonly backoffPeriodMs: number;

  private readonly exponentialFactor: number;

  private backoffPeriods: number;

  readonly decoder: Decoder<T>;

  constructor(
    url: string,
    decoder: Decoder<T>,
    { retryOnDisconnect, cacheSize, cacheExpiryPeriod, exponentialFactor, backoffPeriodMs }: WebSocketConfiguration = {}
  ) {
    this.decoder = decoder;
    this.socketListeners = [];
    this.url = url;
    this.cacheSize = cacheSize ?? 10000;
    this.manuallyClosed = false;
    this.retryOnDisconnect = retryOnDisconnect ?? true;
    this.exponentialFactor = exponentialFactor ?? 2;
    this.backoffPeriodMs = backoffPeriodMs ?? 10;
    this.backoffPeriods = -1;
    this.messageQueue = new BufferQueue<T>(this.cacheSize, cacheExpiryPeriod ?? { seconds: 60 });
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
  open() {
    if (!this.openFuture || this.openFuture?.failed) {
      this.closeFuture = new Future<void>((resolve, reject, signal) => {
        this.closeFutureCallbacks = [resolve, reject, signal];
      }).schedule();
      this.openFuture = new Future<void>((resolve, reject, signal) => {
        signal.onabort = () => {
          this.close();
        };
        let retrying = false;
        const cancelError = this.addEventListener("error", async () => {
          if (this.retryOnDisconnect && !signal.aborted) {
            retrying = true;
            this.getSocket()?.close();
            await Future.sleep({
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
          if (!this.manuallyClosed && this.retryOnDisconnect && !signal.aborted) {
            delete this.openFuture;
            cancelError();
            cancelOpen();
            cancelClose();
            this.open()
              .thenApply(() => resolve())
              .catch(reject);
          } else {
            retrying = false;
            this.closeFutureCallbacks[0]();
            cancelQueue();
            reject(new NetworkError(HTTPStatus.EXPECTATION_FAILED));
          }
        });
        const cancelQueue = this.addEventListener("message", async (evt: MessageEvent) => {
          const data = typeof evt.data === "string" ? new Blob([evt.data]) : (evt.data as Blob);
          const result = this.decoder.decode(data);

          if (result instanceof Future || result instanceof Promise) {
            this.messageQueue.enqueue(await result);
          } else {
            this.messageQueue.enqueue(result);
          }
        });
        this.createSocket();
      });
    }

    return this.openFuture;
  }

  /**
   * Wait for the socket connection closed.
   * @remark
   * This doesn't actually attempt to close the socket, only waits for the connection to close
   */
  closedFuture() {
    if (this.closeFuture) return this.closeFuture;
    throw new NetworkError(HTTPStatus.FORBIDDEN, "Stream not opened");
  }

  /**
   * Closes the socket if currently open
   */
  close() {
    this.manuallyClosed = true;
    this.getSocket()?.close();
    this.messageQueue.clear();
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
  get stream(): Stream<T> {
    const messageStream = this.messageQueue.streamEntries[Symbol.asyncIterator]();
    return new Stream<T>(async (signal) => {
      if (!this.closed) {
        const value = await Promise.race([
          Future.of(
            messageStream.next().then((v) => v.value),
            signal
          ).thenApply((v) => v.value),
          this.closedFuture(),
        ]);
        if (value) return value;
      }
      return new ExecutorState(true);
    });
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
    socket.binaryType = "blob";
    this.socketListeners.forEach(([type, functor]) => socket.addEventListener(type, functor));
    this.socket = socket;
    return socket;
  }

  private getSocket() {
    return this.socket;
  }
}
