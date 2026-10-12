import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { siteConfig } from "@/config/site.config";
import { getCachedLegalLinks, getCachedMenu } from "@/modules/content/cached";

/** Yıl istek anında hesaplanır; prerender sırasında sabitlenmez. */
async function CurrentYear() {
  await connection();
  return <>{new Date().getFullYear()}</>;
}

async function FooterMenu() {
  await connection();
  const [menuItems, legal] = await Promise.all([
    getCachedMenu("footer"),
    getCachedLegalLinks(),
  ]);
  const known = new Set(menuItems.map((item) => item.url));
  const items = [
    ...menuItems.map((item) => ({ label: item.label, url: item.url })),
    ...legal
      .filter((page) => !known.has(page.href))
      .map((page) => ({ label: page.title, url: page.href })),
  ];
  if (items.length === 0) return null;

  return (
    <nav aria-label="Alt menü" className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <Link
          key={`${item.label}-${item.url}`}
          href={item.url}
          className="hover:text-foreground"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground">
        <Suspense fallback={null}>
          <FooterMenu />
        </Suspense>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
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
      </div>
    </footer>
  );
}
