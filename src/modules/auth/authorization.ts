import type { Permission } from "@/shared/permissions";

export function hasPermission(
  granted: readonly string[],
  required: Permission,
): boolean {
  return granted.includes(required);
}

export function hasEveryPermission(
  granted: readonly string[],
  required: readonly Permission[],
): boolean {
  return required.every((permission) => granted.includes(permission));
}
