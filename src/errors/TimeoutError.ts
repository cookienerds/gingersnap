import { FutureCancelled } from "./FutureCancelled";

/**
 * Thrown to indicate that some timed operation has exceeded the maximum duration
 */
export class TimeoutError extends FutureCancelled {}
