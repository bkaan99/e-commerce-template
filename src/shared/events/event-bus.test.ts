import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "./event-bus";

describe("InMemoryEventBus", () => {
  it("yayınlanan olayı abonelere iletir", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe("order.paid", handler);

    await bus.publish("order.paid", { orderId: "o1" });

    expect(handler).toHaveBeenCalledWith({ orderId: "o1" });
  });

  it("başka olayın aboneleri tetiklenmez", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe("order.cancelled", handler);

    await bus.publish("order.paid", { orderId: "o1" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("birden fazla abone sırayla çalışır", async () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe("order.paid", () => void calls.push("a"));
    bus.subscribe("order.paid", () => void calls.push("b"));

    await bus.publish("order.paid", { orderId: "o1" });

    expect(calls).toEqual(["a", "b"]);
  });
});
