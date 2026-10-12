import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import { PERMISSIONS } from "@/shared/permissions";
import type { Actor } from "../orders/admin-order.service";
import { roleInputSchema, staffInviteSchema } from "./role.schema";
import type {
  RoleRecord,
  StaffRecord,
  StaffRepository,
} from "./staff.repository";

/** Personele "parola belirle" bağlantısı gönderir (ör. parola sıfırlama akışı). */
export interface PasswordSetupSender {
  sendPasswordSetup(email: string): Promise<void>;
}

/** İşlemi yapan personel: kimliği ve kendi yetkileri (yetki yükseltmeyi önlemek için). */
export interface StaffActor extends Actor {
  permissions: readonly string[];
}

function firstIssue(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Geçersiz bilgi";
}

export class StaffService {
  constructor(
    private readonly repository: StaffRepository,
    private readonly passwordSetup: PasswordSetupSender,
    private readonly audit: AuditLogger,
  ) {}

  listRoles(): Promise<RoleRecord[]> {
    return this.repository.listRoles();
  }

  listStaff(): Promise<StaffRecord[]> {
    return this.repository.listStaff();
  }

  async saveRole(
    id: string | null,
    raw: unknown,
    actor: StaffActor,
  ): Promise<string> {
    const parsed = roleInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const input = parsed.data;

    if (await this.repository.roleNameTaken(input.name, id ?? undefined)) {
      throw new ConflictError("Bu isimde bir rol zaten var");
    }

    if (!id) {
      this.assertCanGrant(actor, input.permissions);
      const created = await this.repository.createRole(input);
      await this.audit.log({
        actorId: actor.userId,
        ip: actor.ip,
        action: "role.create",
        entityType: "Role",
        entityId: created,
        after: { name: input.name, permissions: input.permissions },
      });
      return created;
    }

    const role = await this.requireRole(id);
    if (role.isSystem) {
      throw new ForbiddenError("Sistem rolleri değiştirilemez");
    }
    // Yetkisi olmadığı izinleri ne ekleyebilir ne de başkasından çıkarabilir.
    this.assertCanGrant(actor, [...input.permissions, ...role.permissions]);

    const dropsManagement =
      role.permissions.includes(PERMISSIONS.ROLE_MANAGE) &&
      !input.permissions.includes(PERMISSIONS.ROLE_MANAGE);
    if (dropsManagement) {
      await this.assertManagersRemain({ roleId: id });
    }

    await this.repository.updateRole(id, input);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "role.update",
      entityType: "Role",
      entityId: id,
      before: { name: role.name, permissions: role.permissions },
      after: { name: input.name, permissions: input.permissions },
    });
    return id;
  }

  async deleteRole(id: string, actor: StaffActor): Promise<void> {
    const role = await this.requireRole(id);
    if (role.isSystem) {
      throw new ForbiddenError("Sistem rolleri silinemez");
    }
    if (role.userCount > 0) {
      throw new ConflictError(
        `Bu role atanmış ${role.userCount} personel var; önce rolü kaldırın`,
      );
    }

    await this.repository.deleteRole(id);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "role.delete",
      entityType: "Role",
      entityId: id,
      before: { name: role.name },
    });
  }

  /** Personeli oluşturur ve parola belirleme bağlantısını e-posta ile gönderir. */
  async invite(raw: unknown, actor: StaffActor): Promise<string> {
    const parsed = staffInviteSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const input = parsed.data;

    if (await this.repository.emailTaken(input.email)) {
      throw new ConflictError("Bu e-posta adresi zaten kayıtlı");
    }
    const roles = await this.resolveRoles(input.roleIds);
    this.assertCanGrant(
      actor,
      roles.flatMap((role) => role.permissions),
    );

    const id = await this.repository.createStaff(input);
    await this.passwordSetup.sendPasswordSetup(input.email);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "staff.invite",
      entityType: "User",
      entityId: id,
      after: { email: input.email, roles: roles.map((role) => role.name) },
    });
    return id;
  }

  async resendInvite(userId: string, actor: StaffActor): Promise<void> {
    const staff = await this.requireStaff(userId);
    if (staff.hasPassword) {
      throw new ConflictError("Bu personel parolasını zaten belirlemiş");
    }
    await this.passwordSetup.sendPasswordSetup(staff.email);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "staff.resend-invite",
      entityType: "User",
      entityId: userId,
    });
  }

  async setRoles(
    userId: string,
    roleIds: string[],
    actor: StaffActor,
  ): Promise<void> {
    this.assertNotSelf(userId, actor);
    const staff = await this.requireStaff(userId);
    if (roleIds.length === 0) {
      throw new ValidationError("En az bir rol seçin");
    }
    const next = await this.resolveRoles(roleIds);
    const current = await this.repository.findRolesByIds(
      staff.roles.map((role) => role.id),
    );
    // Yetkisi olmadığı bir rolü ne verebilir ne de kaldırabilir.
    this.assertCanGrant(
      actor,
      [...next, ...current].flatMap((role) => role.permissions),
    );

    const hadManagement = current.some((role) =>
      role.permissions.includes(PERMISSIONS.ROLE_MANAGE),
    );
    const keepsManagement = next.some((role) =>
      role.permissions.includes(PERMISSIONS.ROLE_MANAGE),
    );
    if (hadManagement && !keepsManagement && staff.isActive) {
      await this.assertManagersRemain({ userId });
    }

    await this.repository.setRoles(userId, roleIds);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "staff.roles",
      entityType: "User",
      entityId: userId,
      before: { roles: staff.roles.map((role) => role.name) },
      after: { roles: next.map((role) => role.name) },
    });
  }

  async setActive(
    userId: string,
    isActive: boolean,
    actor: StaffActor,
  ): Promise<void> {
    this.assertNotSelf(userId, actor);
    const staff = await this.requireStaff(userId);
    if (staff.isActive === isActive) return;

    const roles = await this.repository.findRolesByIds(
      staff.roles.map((role) => role.id),
    );
    this.assertCanGrant(
      actor,
      roles.flatMap((role) => role.permissions),
    );

    if (!isActive) await this.assertManagersRemain({ userId });

    await this.repository.setActive(userId, isActive);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: isActive ? "staff.activate" : "staff.deactivate",
      entityType: "User",
      entityId: userId,
    });
  }

  private assertNotSelf(userId: string, actor: StaffActor): void {
    if (userId === actor.userId) {
      throw new ForbiddenError(
        "Kendi yetkilerinizi veya durumunuzu değiştiremezsiniz",
      );
    }
  }

  private assertCanGrant(
    actor: StaffActor,
    permissions: readonly string[],
  ): void {
    const missing = permissions.filter((p) => !actor.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenError(
        "Kendinizde olmayan yetkileri veremez veya kaldıramazsınız",
      );
    }
  }

  private async assertManagersRemain(exclude: {
    userId?: string;
    roleId?: string;
  }): Promise<void> {
    if ((await this.repository.countActiveManagers(exclude)) < 1) {
      throw new ConflictError(
        "Personel ve rol yönetebilen en az bir etkin kullanıcı kalmalı",
      );
    }
  }

  private async requireRole(id: string): Promise<RoleRecord> {
    const role = await this.repository.findRole(id);
    if (!role) throw new NotFoundError("Rol");
    return role;
  }

  private async requireStaff(id: string): Promise<StaffRecord> {
    const staff = await this.repository.findStaff(id);
    if (!staff) throw new NotFoundError("Personel");
    return staff;
  }

  private async resolveRoles(ids: string[]): Promise<RoleRecord[]> {
    const unique = [...new Set(ids)];
    const roles = await this.repository.findRolesByIds(unique);
    if (roles.length !== unique.length) throw new NotFoundError("Rol");
    return roles;
  }
}
