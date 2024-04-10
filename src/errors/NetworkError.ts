import { HTTPStatus } from "../networking/decorators";

/**
 *Thrown to indicate some networking issue
 */
export class NetworkError extends Error {
  status: HTTPStatus;

  constructor(status: HTTPStatus, body?: string) {
    super(body ?? "");
    this.status = status;
  }
}
