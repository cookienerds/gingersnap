import { Future, WaitPeriod } from "./future";
import { WaitableObject } from "../data-structures/object";

export class FutureEvent {
  private readonly __internal__: WaitableObject<any, any>;

  constructor() {
    this.__internal__ = new WaitableObject();
  }

  get isSet() {
    return this.__internal__.get("set") === true;
  }

  public wait(period?: WaitPeriod) {
    const future = Future.of<FutureEvent>((resolve, reject, signal) => {
      if (!this.isSet) {
        signal.onabort = this.__internal__.on("set", (v) => {
          if (v === true) resolve(this);
        });
      }
    });

    if (period) return Future.waitFor(future, period);
    return future;
  }

  public set() {
    this.__internal__.set("set", true);
  }

  public clear() {
    this.__internal__.set("set", false);
  }
}

export class Lock {
  private __locked__: boolean;
  private evt: FutureEvent;

  constructor() {
    this.__locked__ = false;
    this.evt = new FutureEvent();
  }

  get locked() {
    return this.__locked__;
  }

  public acquire(waitPeriod?: WaitPeriod): Future<Lock> {
    if (this.locked) {
      return this.evt.wait(waitPeriod).thenApply(() => {
        if (this.locked) return this.acquire(waitPeriod);
        return this.reEntrantLock() as any;
      });
    }

    return Future.of<Lock>(this.reEntrantLock());
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
