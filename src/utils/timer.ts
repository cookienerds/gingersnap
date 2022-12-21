export interface WaitPeriod {
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
  hours?: number;
}
export const wait = async (period: WaitPeriod) =>
  await new Promise<void>((resolve) => {
    const totalTime =
      (period.hours ?? 0) * 60 * 60 * 1000 +
      (period.minutes ?? 0) * 60 * 1000 +
      (period.seconds ?? 0) * 1000 +
      (period.milliseconds ?? 0);
    setTimeout(resolve, totalTime);
  });
