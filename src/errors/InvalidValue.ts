import ParsingError from "./ParsingError";

export default class InvalidValue extends ParsingError {
  constructor(message?: string) {
    super([], message);
  }
}
