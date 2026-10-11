import { Suspense } from "react";
import { requireUser } from "@/modules/auth/session";

async function AdminContent() {
  const user = await requireUser();

  return (
    <>
      <h1 className="text-2xl font-semibold">Yönetim paneli</h1>
      <p className="text-muted-foreground">
        {user.name} ({user.email}), {user.permissions.length} yetki
      </p>
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <Suspense fallback={<p>Yükleniyor...</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
