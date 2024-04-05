import { ParseError } from "papaparse";

export class ParsingError extends Error {
  readonly details: ParseError[];

  constructor(records: ParseError[] = [], message?: string) {
    super(message);
    this.details = records;
  }
}
