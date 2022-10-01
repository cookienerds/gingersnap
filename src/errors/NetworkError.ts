import { HTTPStatus } from "../annotations";

export default class NetworkError extends Error {
  status: HTTPStatus;

  constructor(status: HTTPStatus, body?: string) {
    super(body ?? "");
    this.status = status;
  }
}
