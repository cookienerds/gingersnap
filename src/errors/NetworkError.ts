import { HTTPStatus } from "../annotations/service";

export default class NetworkError extends Error {
  status: HTTPStatus;

  constructor(status: HTTPStatus, body?: string) {
    super(body ?? "");
    this.status = status;
  }
}
