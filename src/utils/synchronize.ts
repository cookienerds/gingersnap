import { Future, FutureResult, WaitPeriod } from "./future";
import { ContextManager } from "./context";

export class FutureEvent {
  private readonly __internal__: EventTarget;
  private ready: boolean;

  constructor() {
    this.__internal__ = new EventTarget();
    this.ready = false;
  }

  get isSet() {
    return this.ready;
  }

  public wait(period?: WaitPeriod) {
    const future = Future.of<FutureEvent>((resolve, reject, signal) => {
      if (!this.isSet) {
        const readyCallback = () => resolve(this);
        signal.onabort = () => this.__internal__.removeEventListener('ready', readyCallback);
        this.__internal__.addEventListener('ready', readyCallback, {once: true});
      } else {
        resolve(this);
      }
    });

    if (period) return Future.waitFor(future, period);
    return future;
  }

  public set() {
    this.ready = true;
    this.__internal__.dispatchEvent(new Event('ready'));
  }

  public clear() {
    this.ready = false;
  }
}

export class Lock implements ContextManager<Lock> {
  private __locked__: boolean;
  private evt: FutureEvent;

  constructor() {
    this.__locked__ = false;
    this.evt = new FutureEvent();
  }

  get locked() {
    return this.__locked__;
  }

  with<K>(functor: (value: FutureResult<Lock>) => K) {
    return this.acquire()
      .thenApply(functor)
      .finally(() => this.release());
  }

  public acquire(waitPeriod?: WaitPeriod): Future<Lock> {
    if (this.locked) {
      return this.evt.wait(waitPeriod).thenApply(() => {
        if (this.locked) return this.acquire(waitPeriod);
        return this.reEntrantLock() as any;
      });
    }

    return Future.completed<Lock>(this.reEntrantLock());
  }

  public release() {
    this.__locked__ = false;
    this.evt.set();
  }

  private reEntrantLock() {
    this.__locked__ = true;
    this.evt.clear();
    const newLock = new Lock();
    newLock.evt = this.evt;
    return newLock;
  }
}
