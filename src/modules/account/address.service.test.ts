import { beforeEach, describe, expect, it } from "vitest";
import type { AddressRepository, SavedAddress } from "./address.repository";
import type { SavedAddressInput } from "./address.schema";
import { AddressService } from "./address.service";

class FakeRepo implements AddressRepository {
  items: (SavedAddress & { userId: string })[] = [];
  private seq = 0;

  async list(userId: string) {
    return this.items.filter((a) => a.userId === userId);
  }
  async count(userId: string) {
    return (await this.list(userId)).length;
  }
  async find(userId: string, id: string) {
    return this.items.find((a) => a.userId === userId && a.id === id) ?? null;
  }
  async create(userId: string, input: SavedAddressInput) {
    const id = `a${++this.seq}`;
    this.items.push({ ...input, id, userId } as SavedAddress & {
      userId: string;
    });
    return id;
  }
  async update(userId: string, id: string, input: SavedAddressInput) {
    const index = this.items.findIndex(
      (a) => a.userId === userId && a.id === id,
    );
    if (index < 0) return false;
    this.items[index] = { ...this.items[index]!, ...input } as SavedAddress & {
      userId: string;
    };
    return true;
  }
  async delete(userId: string, id: string) {
    const before = this.items.length;
    this.items = this.items.filter(
      (a) => !(a.userId === userId && a.id === id),
    );
    return this.items.length < before;
  }
}

const raw = {
  title: "Ev",
  firstName: "Ali",
  lastName: "Veli",
  phone: "0555 000 00 00",
  city: "İstanbul",
  district: "Kadıköy",
  addressLine: "Örnek Sokak No: 5 Daire 2",
};

describe("AddressService", () => {
  let repo: FakeRepo;
  let service: AddressService;

  beforeEach(() => {
    repo = new FakeRepo();
    service = new AddressService(repo);
  });

  it("ilk adresi otomatik varsayılan yapar ve telefonu normalleştirir", async () => {
    await service.save("u1", null, raw);
    expect(repo.items[0]).toMatchObject({
      phone: "05550000000",
      isDefaultShipping: true,
      isDefaultBilling: true,
    });
  });

  it("ikinci adresi varsayılan yapmaz", async () => {
    await service.save("u1", null, raw);
    await service.save("u1", null, { ...raw, title: "İş" });
    expect(repo.items[1]).toMatchObject({ isDefaultShipping: false });
  });

  it("adres sayısını sınırlar", async () => {
    for (let i = 0; i < 10; i += 1) await service.save("u1", null, raw);
    await expect(service.save("u1", null, raw)).rejects.toThrow("En fazla 10");
  });

  it("geçersiz adresi reddeder", async () => {
    await expect(
      service.save("u1", null, { ...raw, phone: "123" }),
    ).rejects.toThrow("cep telefonu");
  });

  it("başkasının adresini güncelleyemez veya silemez", async () => {
    await service.save("u1", null, raw);
    const id = repo.items[0]!.id;

    await expect(service.save("u2", id, raw)).rejects.toThrow(
      "Adres bulunamadı",
    );
    await expect(service.remove("u2", id)).rejects.toThrow("Adres bulunamadı");
    expect(repo.items).toHaveLength(1);
  });
});
