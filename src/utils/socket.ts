import NetworkError from "../errors/NetworkError";
import { HTTPStatus } from "../annotations/service";
import { Stream } from "./stream";
import { Queue } from "../data-structures/object/Queue";
import { v4 as uuid } from "uuid";
import StreamEnded from "../errors/StreamEnded";
import { Future, WaitPeriod } from "./future";

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
export class StreamableWebSocket<T extends Blob | ArrayBuffer = Blob> {
  private readonly retryOnDisconnect: boolean;
  private openFuture?: Future<void>;
  private closeFuture?: Future<void>;

  private socketListeners: Array<[keyof WebSocketEventMap, SocketFunctor<any>]>;

  private closeFutureCallbacks!: [() => void, (reason?: any) => void, AbortSignal];

  private readonly messageQueue: Queue<Blob>;
  private readonly streamQueue: Map<string, Queue<Blob>>;

  private readonly url: string;
  private socket?: WebSocket;

  private manuallyClosed: boolean;

  private readonly cacheSize: number;

  private readonly backoffPeriodMs: number;

  private readonly exponentialFactor: number;

  private backoffPeriods: number;

  constructor(
    url: string,
    { retryOnDisconnect, cacheSize, cacheExpiryPeriod, exponentialFactor, backoffPeriodMs }: WebSocketConfiguration = {}
  ) {
    this.socketListeners = [];
    this.url = url;
    this.cacheSize = cacheSize ?? 10000;
    this.manuallyClosed = false;
    this.retryOnDisconnect = retryOnDisconnect ?? true;
    this.exponentialFactor = exponentialFactor ?? 2;
    this.backoffPeriodMs = backoffPeriodMs ?? 10;
    this.backoffPeriods = -1;
    this.messageQueue = new Queue<Blob>(this.cacheSize, cacheExpiryPeriod ?? { seconds: 60 });
    this.streamQueue = new Map<string, Queue<Blob>>();
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
        const cancelQueue = this.addEventListener("message", (evt: MessageEvent) => {
          const data = typeof evt.data === "string" ? new Blob([evt.data]) : evt.data;
          if (this.streamQueue.size > 0) {
            this.loadBackfilledMessages();
            for (const queue of this.streamQueue.values()) queue.enqueue(data);
          } else {
            this.messageQueue.enqueue(data);
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
    this.streamQueue.clear();
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
    const guid = uuid();
    return new Stream<T>(async (signal) => {
      if (!this.closed) {
        const value = await Promise.race([(await this.getQueue(guid)).awaitDequeue(signal), this.closedFuture()]);
        if (value) return value;
        else this.removeQueue(guid);
      }
      throw new StreamEnded();
    });
  }

  private removeQueue(guid: string) {
    this.streamQueue.delete(guid);
  }

  private async getQueue(guid: string) {
    let queue = this.streamQueue.get(guid);
    if (!queue) {
      queue = new Queue<Blob>();
      this.streamQueue.set(guid, queue);
    }
    this.loadBackfilledMessages();
    return queue;
  }

  private loadBackfilledMessages() {
    while (!this.messageQueue.empty) {
      const data = this.messageQueue.dequeue();
      for (const queue of this.streamQueue.values()) {
        queue.enqueue(data);
      }
    }
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
