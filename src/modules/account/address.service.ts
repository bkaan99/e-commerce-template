import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import { MAX_SAVED_ADDRESSES, savedAddressSchema } from "./address.schema";
import type { AddressRepository, SavedAddress } from "./address.repository";

function firstIssue(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Geçersiz bilgi";
}

export class AddressService {
  constructor(private readonly addresses: AddressRepository) {}

  list(userId: string): Promise<SavedAddress[]> {
    return this.addresses.list(userId);
  }

  async save(userId: string, id: string | null, raw: unknown): Promise<string> {
    const parsed = savedAddressSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    if (id) {
      const updated = await this.addresses.update(userId, id, parsed.data);
      if (!updated) throw new NotFoundError("Adres");
      return id;
    }

    if ((await this.addresses.count(userId)) >= MAX_SAVED_ADDRESSES) {
      throw new ConflictError(
        `En fazla ${MAX_SAVED_ADDRESSES} adres kaydedebilirsiniz`,
      );
    }

    // İlk adres otomatik varsayılan olur.
    const first = (await this.addresses.count(userId)) === 0;
    return this.addresses.create(userId, {
      ...parsed.data,
      isDefaultShipping: parsed.data.isDefaultShipping || first,
      isDefaultBilling: parsed.data.isDefaultBilling || first,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const removed = await this.addresses.delete(userId, id);
    if (!removed) throw new NotFoundError("Adres");
  }
}
