import CallExecutionError from "./CallExecutionError";

export default class MissingResponse extends CallExecutionError {
  constructor() {
    super("No response object retrieved from execution");
  }
}
