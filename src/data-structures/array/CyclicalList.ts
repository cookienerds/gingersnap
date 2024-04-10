import { Stream } from "../../stream";

export class CyclicalList<T> extends Array<T> {
  /**
   * Pointer to the current index
   * @private
   */
  protected pointer: number;

  protected readonly maxSize?: number;

  constructor(maxSize?: number) {
    super();
    this.pointer = this.length - 1;
    this.maxSize = maxSize;

    if (maxSize) {
      this.push = (...items) => {
        for (const item of items) {
          this.pointer = (this.pointer + 1) % maxSize;
          this[this.pointer] = item;
        }

        return this.pointer < maxSize ? this.pointer : maxSize;
      };
      this.pop = () => {
        this.pointer--;
        if (this.pointer < -1) {
          this.pointer = -1;
        }
        return super.pop();
      };
      this.shift = () => {
        this.pointer--;
        if (this.pointer < -1) {
          this.pointer = -1;
        }
        return super.shift();
      };
      this.unshift = (...items) => {
        for (let i = items.length - 1; i >= 0; i--) {
          const item = items[i];
          if (this.length >= maxSize) {
            this.pop();
          }
          this.pointer++;
          this.unshift(item);
        }
        return this.length;
      };
    }
  }

  static from<T>(items: T[]) {
    const list = new this<T>(items.length);
    for (const item of items) {
      list.push(item);
    }
    return list;
  }

  get stream() {
    return Stream.of(this);
  }
}
