import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { getStaffService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";
import { RoleManager } from "./role-manager";

export const metadata: Metadata = { title: "Roller ve yetkiler" };

async function RolesContent() {
  const user = await adminPage(PERMISSIONS.ROLE_MANAGE);
  if (!user) return <AccessDenied />;

  const roles = await getStaffService().listRoles();
  return <RoleManager roles={roles} grantable={user.permissions} />;
}

export default function RolesPage() {
  return (
    <>
      <PageHeader
        title="Roller ve yetkiler"
        description="Özel roller oluşturun; yalnızca kendinizde bulunan yetkileri verebilirsiniz. Sistem rolleri değiştirilemez."
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <RolesContent />
      </Suspense>
    </>
  );
}
