import { z } from "zod";
import { ALL_PERMISSIONS } from "@/shared/permissions";

export const roleInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Rol adı en az 2 karakter olmalı")
    .max(40, "Rol adı en fazla 40 karakter olabilir"),
  description: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : null)),
  permissions: z
    .array(z.enum(ALL_PERMISSIONS as [string, ...string[]]))
    .min(1, "En az bir yetki seçin")
    .transform((list) => [...new Set(list)]),
});

export type RoleInput = z.infer<typeof roleInputSchema>;

export const staffInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  firstName: z.string().trim().min(1, "Ad zorunlu").max(60),
  lastName: z.string().trim().min(1, "Soyad zorunlu").max(60),
  roleIds: z.array(z.string()).min(1, "En az bir rol seçin"),
});

export type StaffInvite = z.infer<typeof staffInviteSchema>;
