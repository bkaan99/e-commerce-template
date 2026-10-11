import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { siteConfig } from "@/config/site.config";

/** Yıl istek anında hesaplanır; prerender sırasında sabitlenmez. */
async function CurrentYear() {
  await connection();
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>
          ©{" "}
          <Suspense fallback={null}>
            <CurrentYear />
          </Suspense>{" "}
          {siteConfig.name}
        </p>
        <p className="flex flex-wrap gap-x-4">
          <Link href="/siparis-sorgula" className="hover:text-foreground">
            Sipariş sorgula
          </Link>
          <span>
            {siteConfig.contact.email} · {siteConfig.contact.phone}
          </span>
        </p>
      </div>
    </footer>
  );
}
