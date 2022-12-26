export class Optional<T> {
  private readonly value: T | undefined | null;

  constructor(value?: T) {
    this.value = value;
  }

  empty() {
    return this.value === undefined || this.value === null;
  }

  hasValue() {
    return !this.empty();
  }

  getValue(): T {
    return this.value as T;
  }

  static from<T>(value?: T) {
    return new Optional(value);
  }
}
