import WS from "jest-websocket-mock";
import { StreamableWebSocket } from "../../../src/utils/socket";
import NetworkError from "../../../src/errors/NetworkError";
import { HTTPStatus } from "../../../src/annotations/service";
import { Future } from "../../../src/utils";

describe("Browser WebSocket", function () {
  const url = "ws://localhost.com";
  const url2 = "ws://localhost.test.com";
  const blobDecoder = { decode: (v) => v };
  let server: WS;

  beforeEach(() => {
    server = new WS(url);
  });

  afterEach(() => {
    server?.close();
  });

  it("should establish connection", async () => {
    let connected = false;
    let closed = false;
    server.on("connection", () => (connected = true));
    server.on("close", () => {
      (closed = true)
    });

    const socket = new StreamableWebSocket(url, blobDecoder, { retryOnDisconnect: false });
    await Promise.race([socket.open(), Future.sleep({ seconds: 1 })]).then(() => {
      expect(connected).toBeTruthy();
    });

    socket.close();
    await Future.waitFor(socket.closedFuture(), 1);
    await Future.sleep(1);
    expect(socket.closed).toBeTruthy();
    expect(closed).toBeTruthy();
  });

  it("should send messages", async () => {
    const socket = new StreamableWebSocket(url, blobDecoder, { retryOnDisconnect: false });
    await Future.waitFor(socket.open(), { seconds: 1 });
    socket.send("Hello");
    await Promise.race([server.messagesToConsume.get(), Future.sleep({ seconds: 1 })]).then((result) => {
      expect(result).toEqual("Hello");
    });
    socket.close();
  });

  it("should receive messages", async () => {
    const socket = new StreamableWebSocket<Blob>(url, blobDecoder, { retryOnDisconnect: false });
    const testMessages = ["Hello", "World", "Testing"];

    await Future.waitFor(socket.open(), { seconds: 1 });
    testMessages.forEach((message) => server.send(message));
    const responseMessage = await socket
      .stream()
      .map((v) => v.text())
      .take(testMessages.length)
      .collect();

    expect(responseMessage).toEqual(testMessages);
    socket.close();
  });

  it("should close stream once socket closed", async () => {
    const socket = new StreamableWebSocket<Blob>(url, blobDecoder, { retryOnDisconnect: false });
    const testMessages = ["Hello", "World", "Testing"];

    await Future.waitFor(socket.open(), { seconds: 1 });
    testMessages.forEach((message) => server.send(message));

    Future.sleep({ seconds: 1 })
      .thenApply(() => socket.close())
      .schedule();
    const responseMessage = await socket
      .stream()
      .map(async (v) => await v.text())
      .collect();

    expect(responseMessage).toEqual(testMessages);
    socket.close();
  });

  it("should retry connection", async () => {
    const socket = new StreamableWebSocket<Blob>(url2, blobDecoder);
    socket.open().schedule();
    await Future.sleep({ seconds: 1 });
    expect(socket.opened).toBeFalsy();
    const server2 = new WS(url2);
    try {
      await Future.waitFor(socket.open(), { seconds: 1 });
      expect(socket.opened).toBeTruthy();
    } finally {
      server2.close();
    }
  });

  it("should fail to connect", async () => {
    const socket = new StreamableWebSocket<Blob>(url2, blobDecoder, { retryOnDisconnect: false });
    await expect(Future.waitFor(socket.open(), { seconds: 5 }).run()).rejects.toEqual(
      new NetworkError(HTTPStatus.EXPECTATION_FAILED)
    );
  });
});
