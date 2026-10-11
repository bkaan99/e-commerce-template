import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAuditQueryService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";

export const metadata: Metadata = { title: "Denetim günlüğü" };

const PAGE_SIZE = 50;

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">–</span>;
  return (
    <pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-words text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

async function AuditContent({
  searchParams,
}: Pick<PageProps<"/admin/denetim">, "searchParams">) {
  const user = await adminPage(PERMISSIONS.AUDIT_VIEW);
  if (!user) return <AccessDenied />;

  const params = await searchParams;
  const action = typeof params["islem"] === "string" ? params["islem"] : "";
  const entityType =
    typeof params["varlik"] === "string" ? params["varlik"] : "";
  const page = Math.max(1, Number(params["sayfa"]) || 1);

  const result = await getAuditQueryService().search({
    action: action || undefined,
    entityType: entityType || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const queryFor = (target: number) => {
    const query = new URLSearchParams();
    if (action) query.set("islem", action);
    if (entityType) query.set("varlik", entityType);
    if (target > 1) query.set("sayfa", String(target));
    const text = query.toString();
    return `/admin/denetim${text ? `?${text}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <form action="/admin/denetim" className="flex flex-wrap gap-2">
        <Input
          name="islem"
          defaultValue={action}
          placeholder="İşlem (örn. order.ship)"
          className="max-w-xs"
          aria-label="İşlem"
        />
        <Select
          name="varlik"
          defaultValue={entityType}
          className="max-w-48"
          aria-label="Varlık"
        >
          <option value="">Tüm varlıklar</option>
          {result.entityTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filtrele
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{result.total} kayıt</p>

      <Table>
        <THead>
          <tr>
            <TH>Zaman</TH>
            <TH>Kullanıcı</TH>
            <TH>İşlem</TH>
            <TH>Varlık</TH>
            <TH>Önce</TH>
            <TH>Sonra</TH>
          </tr>
        </THead>
        <TBody>
          {result.items.map((row) => (
            <TR key={row.id}>
              <TD className="whitespace-nowrap">
                {row.createdAt.toLocaleString("tr-TR")}
              </TD>
              <TD>
                <div>{row.actorName ?? "Sistem"}</div>
                <div className="text-xs text-muted-foreground">
                  {row.actorEmail}
                  {row.ip ? ` · ${row.ip}` : ""}
                </div>
              </TD>
              <TD className="font-mono text-xs">{row.action}</TD>
              <TD>
                {row.entityType}
                {row.entityId ? (
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.entityId}
                  </div>
                ) : null}
              </TD>
              <TD>
                <Json value={row.before} />
              </TD>
              <TD>
                <Json value={row.after} />
              </TD>
            </TR>
          ))}
          {result.items.length === 0 ? (
            <TR>
              <TD
                colSpan={6}
                className="py-8 text-center text-muted-foreground"
              >
                Kayıt bulunamadı.
              </TD>
            </TR>
          ) : null}
        </TBody>
      </Table>

      {result.totalPages > 1 ? (
        <nav className="flex items-center gap-3 text-sm" aria-label="Sayfalama">
          {page > 1 ? <Link href={queryFor(page - 1)}>Önceki</Link> : null}
          <span className="text-muted-foreground">
            {page} / {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Link href={queryFor(page + 1)}>Sonraki</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

export default function AdminAuditPage({
  searchParams,
}: PageProps<"/admin/denetim">) {
  return (
    <>
      <PageHeader
        title="Denetim günlüğü"
        description="Yönetim panelinde yapılan değişikliklerin kaydı. Kayıtlar düzenlenemez."
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <AuditContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
