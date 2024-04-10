/**
 * Thrown when a network call fails to be executed successfully
 */
export class CallExecutionError extends Error {
  readonly response?: Response;

  constructor(message: string, response?: Response) {
    super(message);
    this.response = response;
  }
}
