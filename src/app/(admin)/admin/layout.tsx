import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site.config";
import { visibleNav } from "@/modules/admin/navigation";
import { requireStaff } from "@/modules/auth/session";

export const metadata: Metadata = {
  title: { default: "Yönetim", template: "%s | Yönetim" },
  robots: { index: false, follow: false },
};

async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const nav = visibleNav(user.permissions, { b2bEnabled: features.b2b });

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-muted/40 md:w-60 md:border-b-0 md:border-r">
        <div className="flex flex-col gap-4 p-4">
          <Link href="/admin" className="text-lg font-semibold">
            {siteConfig.name}
          </Link>
          <nav
            aria-label="Yönetim menüsü"
            className="flex flex-wrap gap-1 md:flex-col"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-theme px-3 py-2 text-sm hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>{user.name || user.email}</span>
            <Link href="/" className="underline">
              Siteyi görüntüle
            </Link>
          </div>
        </div>
      </aside>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense
      fallback={<p className="p-6 text-muted-foreground">Yükleniyor...</p>}
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
