export class ExecutorState<T> {
  readonly done: boolean;
  readonly value: T;

  constructor(done: boolean, value: T = null as T) {
    this.done = done;
    this.value = value;
  }
}
