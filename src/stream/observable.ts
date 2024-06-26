import { Stream } from "./index";
import { WaitPeriod } from "../future";
import { Queue } from "../data-structures/object";

/**
 * Provides a Publisher-Subscriber service around an event stream
 */
export abstract class Observable<T> {
  /**
   * Dispatches data to all subscribers listening on the provided topic
   * @param topic
   * @param data
   */
  abstract publish(topic: string, data: T): void;

  /**
   * Monitor for incoming data on the provided topic. If topic is '*', then
   * will subscribe to all incoming data
   * @param topic
   * @param bufferSize
   * @param expiryPeriod
   */
  abstract subscribe(
    topic: string | RegExp,
    bufferSize?: number,
    expiryPeriod?: WaitPeriod
  ): Stream<{ topic: string; data: T }>;

  /**
   * Pull data off a stream and publishes it
   * @param topic topic used to dispatch data to subscribers
   * @param stream any data stream
   */
  publishFromStream(topic: string, stream: Stream<T>) {
    return stream
      .map((data) => this.publish(topic, data))
      .consume()
      .schedule();
  }
}

/**
 * Provides Publisher-Subscriber service around an EventTarget
 */
export class ObservableEventTarget<T> extends Observable<T> {
  private readonly __internal__: EventTarget;

  constructor() {
    super();
    this.__internal__ = new EventTarget();
  }

  publish(topic: string, data: T) {
    this.__internal__.dispatchEvent(new CustomEvent(topic, { detail: { topic, data } }));
    this.__internal__.dispatchEvent(new CustomEvent("*", { detail: { topic, data } }));
  }

  subscribe(
    topic: string | RegExp,
    bufferSize: number | undefined = undefined,
    expiryPeriod: WaitPeriod | undefined = undefined
  ): Stream<{ topic: string; data: T }> {
    const queue = new Queue<any>(bufferSize, expiryPeriod);
    const listener =
      typeof topic === "string"
        ? (evt: any) => queue.enqueue(evt.detail)
        : (evt: any) => {
            if (topic.test(evt.detail.topic)) {
              queue.enqueue(evt.detail);
            }
          };
    const listeningTopic = typeof topic === "string" ? topic : "*";

    return Stream.seed(() => {
      this.__internal__.addEventListener(listeningTopic, listener);
      return queue.streamEntries;
    }).registerCompletionHook(() => {
      this.__internal__.removeEventListener(listeningTopic, listener);
      queue.clear();
    });
  }
}

/**
 * Provides Publisher-Subscriber service around a MessagePort
 */
export class ObservableMessagePort<T> extends Observable<T> {
  constructor(private readonly messagePort: MessagePort) {
    super();
  }

  publish(topic: string, data: T): void {
    this.messagePort.postMessage({ topic, data });
  }

  subscribe(
    topic: string | RegExp,
    bufferSize: number | undefined = undefined,
    expiryPeriod: WaitPeriod | undefined = undefined
  ): Stream<{ topic: string; data: T }> {
    const queue = new Queue<any>(bufferSize, expiryPeriod);
    const listener =
      typeof topic === "string"
        ? (evt: any) => {
            if (topic === "*" || evt.data.topic === topic) {
              queue.enqueue(evt.data);
            }
          }
        : (evt: any) => {
            if (topic.test(evt.data.topic)) {
              queue.enqueue(evt.data);
            }
          };

    return Stream.seed(() => {
      this.messagePort.addEventListener("message", listener);
      return queue.streamEntries;
    }).registerCompletionHook(() => {
      this.messagePort.removeEventListener("message", listener);
      queue.clear();
    });
  }
}
