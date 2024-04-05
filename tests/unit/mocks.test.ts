import { exact, MockNetworkService, request, response } from "../../src/mocks";
import { HTTPStatus } from "../../src/networking";
import { RequestType } from "../../src/networking/types";

describe("MockWebService", () => {
  const service = new MockNetworkService();

  beforeAll(() => {
    service.start();
  });

  afterEach(() => {
    service.reset();
  });

  afterAll(() => {
    service.stop();
  });

  it("should mock fetch request", async () => {
    const api = service.createAPI("https://localhost:8080");
    api.when(
      request().withPath("/api/v1/user").withMethod(RequestType.GET),
      response().withStatus(HTTPStatus.BAD_REQUEST)
    );

    api.when(
      request().withPath("/api/v1/user").withMethod(RequestType.POST).withBody("testUser"),
      response().withStatus(HTTPStatus.CREATED)
    );

    const resp = await fetch("https://localhost:8080/api/v1/user");
    expect(resp.status).toBe(HTTPStatus.BAD_REQUEST);
    await api.verify(request().withPath("/api/v1/user").withMethod(RequestType.GET), exact(1));

    const resp2 = await fetch("https://localhost:8080/api/v1/user", { method: "POST", body: "testUser" });
    expect(resp2.status).toBe(HTTPStatus.CREATED);

    await api.verify(request().withPath("/api/v1/user").withMethod(RequestType.POST), exact(1));
    await api.verify(request().withPath("/api/v1/user"), exact(2));
    await api.verify(request().withPath("/api"), exact(2));
  });
});
