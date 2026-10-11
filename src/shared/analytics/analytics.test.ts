import { describe, expect, it, vi } from "vitest";
import { toGa4Call, toMetaCall } from "./adapters";
import { AnalyticsDispatcher, type ConsentState } from "./dispatcher";
import type { AnalyticsAdapter, AnalyticsEvent } from "./events";

const item = { id: "p1", name: "Tişört", price: 100, variant: "Siyah / M" };
const viewItem: AnalyticsEvent = {
  name: "view_item",
  payload: { currency: "TRY", value: 100, item },
};

describe("AnalyticsDispatcher", () => {
  function setup(consent: ConsentState) {
    const track = vi.fn();
    const adapter: AnalyticsAdapter = { name: "test", track };
    const dispatcher = new AnalyticsDispatcher(() => consent);
    dispatcher.register(adapter);
    return { dispatcher, track };
  }

  it("onay verilmişse adapter'a olay gönderir", () => {
    const { dispatcher, track } = setup("granted");
    dispatcher.track("view_item", { currency: "TRY", value: 100, item });
    expect(track).toHaveBeenCalledTimes(1);
  });

  it.each(["denied", "unknown"] as const)(
    "onay %s iken hiçbir olay göndermez",
    (state) => {
      const { dispatcher, track } = setup(state);
      dispatcher.track("view_item", { currency: "TRY", value: 100, item });
      expect(track).not.toHaveBeenCalled();
    },
  );

  it("bir adapter hata verse de diğerlerini çalıştırır", () => {
    const dispatcher = new AnalyticsDispatcher(() => "granted");
    const second = vi.fn();
    dispatcher.register({
      name: "broken",
      track: () => {
        throw new Error("boom");
      },
    });
    dispatcher.register({ name: "ok", track: second });

    expect(() =>
      dispatcher.track("view_item", { currency: "TRY", value: 100, item }),
    ).not.toThrow();
    expect(second).toHaveBeenCalled();
  });
});

describe("adapter eşlemeleri", () => {
  it("GA4 view_item parametrelerini üretir", () => {
    expect(toGa4Call(viewItem)).toEqual({
      name: "view_item",
      params: {
        currency: "TRY",
        value: 100,
        items: [
          {
            item_id: "p1",
            item_name: "Tişört",
            price: 100,
            quantity: 1,
            item_variant: "Siyah / M",
            item_brand: undefined,
            item_category: undefined,
          },
        ],
      },
    });
  });

  it("GA4 purchase olayında transaction_id kullanır", () => {
    const call = toGa4Call({
      name: "purchase",
      payload: {
        transactionId: "T-1",
        currency: "TRY",
        value: 200,
        items: [item],
      },
    });
    expect(call.name).toBe("purchase");
    expect(call.params["transaction_id"]).toBe("T-1");
  });

  it("Meta Pixel standart olay adlarına çevirir", () => {
    expect(toMetaCall(viewItem)?.name).toBe("ViewContent");
    expect(
      toMetaCall({
        name: "add_to_cart",
        payload: { currency: "TRY", value: 100, item },
      })?.name,
    ).toBe("AddToCart");
  });

  it("karşılığı olmayan olayda null döner", () => {
    expect(
      toMetaCall({
        name: "view_cart",
        payload: { currency: "TRY", value: 0, items: [] },
      }),
    ).toBeNull();
  });
});
