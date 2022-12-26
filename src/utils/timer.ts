import { Future } from "./future";
import TimeoutError from "../errors/TimeoutError";

export interface WaitPeriod {
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
  hours?: number;
}
export const wait = (period: WaitPeriod | number) =>
  new Future<void>((resolve, reject, signal) => {
    const totalTime =
      typeof period === "number"
        ? period * 1000
        : (period.hours ?? 0) * 60 * 60 * 1000 +
          (period.minutes ?? 0) * 60 * 1000 +
          (period.seconds ?? 0) * 1000 +
          (period.milliseconds ?? 0);
    const timer = setTimeout(resolve, totalTime);
    signal.onabort = () => {
      clearTimeout(timer);
      reject(new TimeoutError());
    };
  });
