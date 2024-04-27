import { Future } from "../../../src/future";
import { ObservableEventTarget, ObservableMessagePort } from "../../../src/stream/observable";
import { Stream } from "../../../src/stream";

describe("Observable", () => {
  it("should allow easy pubsub from ObservableEventTarget", async () => {
    const observable = new ObservableEventTarget<string>();
    const result1 = observable
      .subscribe("test")
      .map((v) => v.data)
      .execute();
    const result2 = observable
      .subscribe(/testing_(\d+)/)
      .map((v) => v.data)
      .execute();

    await Future.sleep({ milliseconds: 100 });
    observable.publish("test", "message");
    observable.publish("testing_123", "message_123");
    expect(await result1).toEqual("message");
    expect(await result2).toEqual("message_123");
  });

  it("should allow easy pubsub from ObservableMessagePort", async () => {
    const { port1, port2 } = new MessageChannel();
    const observable1 = new ObservableMessagePort<string>(port1);
    const observable2 = new ObservableMessagePort<string>(port2);
    const result1 = observable1
      .subscribe("test")
      .map((v) => v.data)
      .execute();
    const result2 = observable1
      .subscribe(/testing_(\d+)/)
      .map((v) => v.data)
      .execute();

    await Future.sleep({ milliseconds: 100 });
    observable2.publish("test", "message");
    observable2.publish("testing_123", "message_123");
    expect(await result1).toEqual("message");
    expect(await result2).toEqual("message_123");
  });

  it("should publish data from stream", async () => {
    const observable = new ObservableEventTarget<string>();
    const result = observable
      .subscribe("test")
      .map((v) => v.data)
      .execute();

    await Future.sleep({ milliseconds: 100 });
    observable.publishFromStream("test", Stream.of(["message", "message_123"]));
    expect(await result).toEqual("message");
  });
});
