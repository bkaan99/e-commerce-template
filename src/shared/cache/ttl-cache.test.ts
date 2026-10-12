import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  it("TTL içinde yeniden yüklemez, süre dolunca yükler", async () => {
    let now = 0;
    const loader = vi.fn(
      async (key: string) => `${key}-${loader.mock.calls.length}`,
    );
    const cache = new TtlCache(loader, 1000, () => now);

    expect(await cache.get("a")).toBe("a-1");
    now = 999;
    expect(await cache.get("a")).toBe("a-1");
    now = 1000;
    expect(await cache.get("a")).toBe("a-2");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("eşzamanlı istekleri tek yüklemede birleştirir", async () => {
    const loader = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 1;
    });
    const cache = new TtlCache(loader, 1000);

    const results = await Promise.all([
      cache.get("k"),
      cache.get("k"),
      cache.get("k"),
    ]);
    expect(results).toEqual([1, 1, 1]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("hataları önbelleğe almaz", async () => {
    const loader = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("db"))
      .mockResolvedValueOnce("ok");
    const cache = new TtlCache(loader, 1000);

    await expect(cache.get("k")).rejects.toThrow("db");
    expect(await cache.get("k")).toBe("ok");
  });

  it("invalidate sonrası yeniden yükler; yükleme sırasında yapılan invalidate sonucu saklamaz", async () => {
    let version = 1;
    const loader = vi.fn(async () => version);
    const cache = new TtlCache(loader, 1000);

    expect(await cache.get("k")).toBe(1);
    version = 2;
    cache.invalidate();
    expect(await cache.get("k")).toBe(2);

    const slow = new TtlCache(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return version;
    }, 1000);
    const first = slow.get("k");
    slow.invalidate();
    await first;
    version = 3;
    expect(await slow.get("k")).toBe(3);
  });
});
