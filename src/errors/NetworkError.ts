import { HTTPStatus } from "../annotations/service/network";

export default class NetworkError extends Error {
  status: HTTPStatus;

  constructor(status: HTTPStatus, body?: string) {
    super(body ?? "");
    this.status = status;
  }
}
