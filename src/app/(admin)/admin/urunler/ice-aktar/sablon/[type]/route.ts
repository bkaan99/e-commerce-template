import { connection } from "next/server";
import { requirePermission } from "@/modules/auth/session";
import { isAppError } from "@/shared/errors";
import { toCsv } from "@/shared/csv";
import { PERMISSIONS } from "@/shared/permissions";

const TEMPLATES = {
  urunler: {
    headers: [
      "urun_adi",
      "kategori",
      "marka",
      "aciklama",
      "durum",
      "kdv",
      "sku",
      "barkod",
      "fiyat",
      "indirimsiz_fiyat",
      "stok",
      "secenek1",
      "deger1",
      "secenek2",
      "deger2",
      "gorsel",
    ],
    rows: [
      [
        "Basic Tişört",
        "erkek-giyim",
        "Nordik",
        "Yumuşak pamuk",
        "taslak",
        20,
        "TSORT-S-SIYAH",
        "",
        "299,90",
        "",
        25,
        "Beden",
        "S",
        "Renk",
        "Siyah",
        "/placeholder.svg",
      ],
      [
        "Basic Tişört",
        "erkek-giyim",
        "",
        "",
        "",
        "",
        "TSORT-M-SIYAH",
        "",
        "299,90",
        "",
        40,
        "Beden",
        "M",
        "Renk",
        "Siyah",
        "",
      ],
    ],
  },
  guncelle: {
    headers: ["sku", "fiyat", "indirimsiz_fiyat", "stok"],
    rows: [
      ["TSORT-S-SIYAH", "279,90", "349,90", 30],
      ["TSORT-M-SIYAH", "", "-", 12],
    ],
  },
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ type: string }> },
) {
  await connection();
  const { type } = await context.params;
  const template = TEMPLATES[type as keyof typeof TEMPLATES];
  if (!template) return new Response("Bulunamadı", { status: 404 });

  try {
    await requirePermission(PERMISSIONS.IMPORT_RUN);
  } catch (error) {
    if (isAppError(error) && error.httpStatus === 403) {
      return new Response("Yetkiniz yok", { status: 403 });
    }
    throw error;
  }

  return new Response(toCsv(template.headers, template.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sablon-${type}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
