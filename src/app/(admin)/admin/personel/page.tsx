import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { getStaffService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";
import { StaffManager } from "./staff-manager";

export const metadata: Metadata = { title: "Personel" };

async function StaffContent() {
  const user = await adminPage(PERMISSIONS.ROLE_MANAGE);
  if (!user) return <AccessDenied />;

  const service = getStaffService();
  const [staff, roles] = await Promise.all([
    service.listStaff(),
    service.listRoles(),
  ]);

  return (
    <StaffManager
      staff={staff.map((member) => ({
        id: member.id,
        email: member.email,
        name: member.name,
        isActive: member.isActive,
        hasPassword: member.hasPassword,
        roleIds: member.roles.map((role) => role.id),
        isSelf: member.id === user.id,
      }))}
      roles={roles.map((role) => ({ id: role.id, name: role.name }))}
    />
  );
}

export default function StaffPage() {
  return (
    <>
      <PageHeader title="Personel" />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <StaffContent />
      </Suspense>
    </>
  );
}
