import WS from "jest-websocket-mock";
import { wait } from "../../../src/utils/timer";
import { BrowserWebSocket } from "../../../src/utils/socket";
import NetworkError from "../../../src/errors/NetworkError";
import { HTTPStatus } from "../../../src/annotations/service";

describe("Browser WebSocket", function () {
  const url = "ws://localhost.com";
  const url2 = "ws://localhost.test.com";
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
    server.on("close", () => (closed = true));

    const socket = new BrowserWebSocket(url, { retryOnDisconnect: false });
    await Promise.race([socket.open(), wait({ seconds: 1 })]).then(() => {
      expect(connected).toBeTruthy();
    });

    socket.close();
    await Promise.race([socket.awaitClosed(), wait({ seconds: 1 })]).then(() => {
      expect(closed).toBeTruthy();
    });
  });

  it("should send messages", async () => {
    const socket = new BrowserWebSocket(url, { retryOnDisconnect: false });
    await Promise.race([socket.open(), wait({ seconds: 1 })]);
    socket.send("Hello");
    await Promise.race([server.messagesToConsume.get(), wait({ seconds: 1 })]).then((result) => {
      expect(result).toEqual("Hello");
    });
    socket.close();
  });

  it("should receive messages", async () => {
    const socket = new BrowserWebSocket<Blob>(url, { retryOnDisconnect: false });
    const testMessages = ["Hello", "World", "Testing"];

    await Promise.race([socket.open(), wait({ seconds: 1 })]);
    testMessages.forEach((message) => server.send(message));
    const responseMessage = await socket.stream
      .map(async (v) => await v.text())
      .take(testMessages.length)
      .collect();

    expect(responseMessage).toEqual(testMessages);
    socket.close();
  });

  it("should close stream once socket closed", async () => {
    const socket = new BrowserWebSocket<Blob>(url, { retryOnDisconnect: false });
    const testMessages = ["Hello", "World", "Testing"];

    await Promise.race([socket.open(), wait({ seconds: 1 })]);
    testMessages.forEach((message) => server.send(message));

    void wait({ seconds: 1 }).then(() => socket.close());
    const responseMessage = await socket.stream.map(async (v) => await v.text()).collect();

    expect(responseMessage).toEqual(testMessages);
    socket.close();
  });

  it("should fail to connect", async () => {
    const socket = new BrowserWebSocket<Blob>(url2, { retryOnDisconnect: false });
    await expect(Promise.race([socket.open(), wait({ seconds: 1 })])).rejects.toEqual(
      new NetworkError(HTTPStatus.EXPECTATION_FAILED)
    );
  });

  it("should retry connection", async () => {
    const socket = new BrowserWebSocket<Blob>(url2);
    await Promise.race([socket.open(), wait({ seconds: 1 })]);
    expect(socket.opened).toBeFalsy();
    const server2 = new WS(url2);
    try {
      await Promise.race([socket.open(), wait({ seconds: 1 })]);
      expect(socket.opened).toBeTruthy();
    } finally {
      server2.close();
    }
  });
});
