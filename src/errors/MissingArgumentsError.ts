/**
 * Thrown to indicate that one or more required arguments of a method/function is missing
 */
export class MissingArgumentsError extends Error {
  readonly arguments: any[];

  constructor(args: string[]) {
    super(`Missing the following arguments: ${args.join(",")}`);
    this.arguments = args;
  }
}
