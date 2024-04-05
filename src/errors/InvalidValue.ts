import { ParsingError } from "./ParsingError";

export class InvalidValue extends ParsingError {
  constructor(message?: string) {
    super([], message);
  }
}
