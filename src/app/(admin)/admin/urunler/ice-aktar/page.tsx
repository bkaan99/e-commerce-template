import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Ürün içe aktarma" };

async function ImportContent() {
  const user = await adminPage(PERMISSIONS.IMPORT_RUN);
  if (!user) return <AccessDenied />;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Dosya <strong>CSV</strong> olmalı (Excel&apos;den “CSV UTF-8” olarak
          kaydedin). Ayraç olarak <code>;</code> veya <code>,</code>{" "}
          kullanılabilir.
        </p>
        <ul className="list-inside list-disc">
          <li>
            <strong>Yeni ürün:</strong> her satır bir varyanttır; aynı{" "}
            <code>urun_adi</code> (veya <code>slug</code>) tek ürün olur.
            Kategori slug veya adıyla, marka adıyla eşleşir. Mevcut ürün ve
            SKU&apos;lar atlanır. Durum belirtilmezse <em>taslak</em> olur.
          </li>
          <li>
            <strong>Toplu güncelleme:</strong> SKU ile eşleşir; boş hücre o
            alanı değiştirmez, <code>indirimsiz_fiyat</code> için <code>-</code>{" "}
            değeri alanı temizler. Hatalı satır varsa hiçbir güncelleme
            uygulanmaz.
          </li>
        </ul>
        <p className="flex gap-4">
          <a
            href="/admin/urunler/ice-aktar/sablon/urunler"
            download
            className="underline"
          >
            Ürün şablonu
          </a>
          <a
            href="/admin/urunler/ice-aktar/sablon/guncelle"
            download
            className="underline"
          >
            Güncelleme şablonu
          </a>
        </p>
      </div>
      <ImportForm />
    </div>
  );
}

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Ürün içe aktarma" />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <ImportContent />
      </Suspense>
    </>
  );
}
