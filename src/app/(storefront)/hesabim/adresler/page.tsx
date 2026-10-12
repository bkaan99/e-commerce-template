import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAddressService } from "@/modules/account/container";
import { requireUser } from "@/modules/auth/session";
import { AddressManager } from "./address-manager";

export const metadata: Metadata = {
  title: "Adreslerim",
  robots: { index: false },
};

async function AddressesContent() {
  const user = await requireUser();
  const addresses = await getAddressService().list(user.id);
  return <AddressManager addresses={addresses} />;
}

export default function AddressesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Adreslerim</h1>
        <Link href="/hesabim" className="text-sm underline">
          Hesabıma dön
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <AddressesContent />
      </Suspense>
    </div>
  );
}
