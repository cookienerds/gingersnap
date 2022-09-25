export default class MissingArgumentsError extends Error {
  readonly arguments: any[];

  constructor(args: string[]) {
    super(`Missing the following arguments: ${args.join(",")}`);
    this.arguments = args;
  }
}
