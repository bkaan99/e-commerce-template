import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalDiskStorage } from "./local-storage";

describe("LocalDiskStorage", () => {
  let dir: string;
  let storage: LocalDiskStorage;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "storage-test-"));
    storage = new LocalDiskStorage(dir);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("dosyayı yazar, okur ve siler", async () => {
    const url = await storage.put("product/a.png", Buffer.from("x"));
    expect(url).toBe("/uploads/product/a.png");

    const file = await storage.read("product/a.png");
    expect(file?.contentType).toBe("image/png");
    expect(file?.data.toString()).toBe("x");

    await storage.remove("product/a.png");
    expect(await storage.read("product/a.png")).toBeNull();
  });

  it("kök dizin dışına çıkan anahtarları reddeder", async () => {
    await expect(storage.put("../kacak.png", Buffer.from("x"))).rejects.toThrow(
      "Geçersiz",
    );
    await expect(storage.read("../../etc/passwd")).rejects.toThrow("Geçersiz");
  });
});
