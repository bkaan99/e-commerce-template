import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getProfileService } from "@/modules/account/container";
import { requireUser } from "@/modules/auth/session";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata: Metadata = {
  title: "Hesap ayarları",
  robots: { index: false },
};

async function SettingsContent() {
  const user = await requireUser();
  const stored = await getProfileService().getProfile(user.id);
  const profile = {
    email: stored.email,
    firstName: stored.firstName,
    lastName: stored.lastName,
    phone: stored.phone ?? "",
  };

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Kişisel bilgiler</h2>
        <ProfileForm {...profile} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Parola</h2>
        <PasswordForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Verilerim (KVKK)</h2>
        <p className="text-sm text-muted-foreground">
          Hesabınızda tuttuğumuz kişisel verilerin bir kopyasını JSON olarak
          indirebilirsiniz.
        </p>
        <a
          href="/hesabim/verilerim"
          download
          className="w-fit rounded-theme border border-border px-4 py-2 text-sm"
        >
          Verilerimi indir
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-red-700">Hesabı sil</h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hesap ayarları</h1>
        <Link href="/hesabim" className="text-sm underline">
          Hesabıma dön
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <SettingsContent />
      </Suspense>
    </div>
  );
}
