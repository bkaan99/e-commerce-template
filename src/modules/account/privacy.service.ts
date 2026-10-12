import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import type { PasswordHasher } from "../auth/password-hasher";
import type { PrivacyRepository, UserDataExport } from "./privacy.repository";

/** KVKK kapsamında veri dışa aktarma ve hesap silme (anonimleştirme). */
export class PrivacyService {
  constructor(
    private readonly privacy: PrivacyRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditLogger,
  ) {}

  async exportData(userId: string): Promise<UserDataExport> {
    const data = await this.privacy.collectExport(userId);
    if (!data) throw new NotFoundError("Hesap");

    await this.audit.log({
      actorId: userId,
      action: "privacy.export",
      entityType: "User",
      entityId: userId,
    });
    return data;
  }

  /**
   * Hesabı kalıcı olarak anonimleştirir. Parola doğrulaması ve açık sipariş
   * kontrolü zorunludur. Siparişler yasal saklama gereği korunur.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const identity = await this.privacy.findIdentity(userId);
    if (!identity || identity.anonymized) throw new NotFoundError("Hesap");

    if (identity.type === "STAFF") {
      throw new ForbiddenError("Personel hesapları buradan silinemez");
    }
    if (!identity.passwordHash) {
      throw new ValidationError("Hesap silinemedi");
    }
    if (!(await this.hasher.verify(identity.passwordHash, password))) {
      throw new ValidationError("Parolanız hatalı");
    }

    if ((await this.privacy.openOrderCount(userId)) > 0) {
      throw new ConflictError(
        "Tamamlanmamış siparişleriniz var. Siparişler tamamlandıktan sonra hesabınızı silebilirsiniz.",
      );
    }

    await this.privacy.anonymize(userId);
    await this.audit.log({
      actorId: null,
      action: "privacy.delete-account",
      entityType: "User",
      entityId: userId,
    });
  }
}
