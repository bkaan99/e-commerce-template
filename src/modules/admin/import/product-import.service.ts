import { ValidationError, isAppError } from "@/shared/errors";
import { parseCsvRecords } from "@/shared/csv-parse";
import { slugify } from "@/shared/slug";
import type { Actor } from "../orders/admin-order.service";
import {
  ProductValidationError,
  type ProductAdminService,
} from "../catalog/product-admin.service";
import { missingColumns, normalizeHeader } from "./headers";
import {
  MAX_IMPORT_ROWS,
  type ProductImportReport,
  type RowIssue,
} from "./import.types";

export interface ImportRepository {
  taxonomy(): Promise<{
    categories: { id: string; name: string; slug: string }[];
    brands: { id: string; name: string }[];
  }>;
  existingSkus(skus: string[]): Promise<string[]>;
  existingSlugs(slugs: string[]): Promise<string[]>;
}

const REQUIRED = ["urun_adi", "kategori", "sku", "fiyat", "stok"];
const MAX_OPTION_AXES = 3;
const DEFAULT_TAX_RATE = 20;

const STATUS_MAP: Record<string, "DRAFT" | "ACTIVE" | "ARCHIVED"> = {
  aktif: "ACTIVE",
  active: "ACTIVE",
  taslak: "DRAFT",
  draft: "DRAFT",
  arsiv: "ARCHIVED",
  archived: "ARCHIVED",
};

interface Row {
  row: number;
  cells: Record<string, string>;
}

interface ProductGroup {
  key: string;
  rows: Row[];
}

function groupKey(cells: Record<string, string>): string {
  return (cells["slug"] || cells["urun_adi"] || "").trim().toLowerCase();
}

/**
 * CSV'den ürün içe aktarma. Her satır bir varyanttır; aynı ürün adı/slug'a
 * sahip satırlar tek ürün olur. Yeni ürünler mevcut doğrulama kurallarıyla
 * (ProductAdminService) oluşturulur; mevcut ürünler güncellenmez.
 */
export class ProductImportService {
  constructor(
    private readonly products: ProductAdminService,
    private readonly repository: ImportRepository,
  ) {}

  async run(
    csv: string,
    options: { dryRun: boolean },
    actor: Actor,
  ): Promise<ProductImportReport> {
    const { headers, records } = parseCsvRecords(csv, normalizeHeader);

    const missing = missingColumns(headers, REQUIRED);
    if (missing.length > 0) {
      throw new ValidationError(`Eksik sütun: ${missing.join(", ")}`);
    }
    if (records.length === 0) throw new ValidationError("Dosyada satır yok");
    if (records.length > MAX_IMPORT_ROWS) {
      throw new ValidationError(
        `Tek dosyada en fazla ${MAX_IMPORT_ROWS} satır işlenebilir`,
      );
    }

    const groups = this.group(
      records.map((cells, index) => ({ row: index + 2, cells })),
    );
    const taxonomy = await this.repository.taxonomy();
    const [takenSkus, takenSlugs] = await Promise.all([
      this.repository.existingSkus(
        records.map((r) => r["sku"] ?? "").filter(Boolean),
      ),
      this.repository.existingSlugs(
        groups.map((g) =>
          slugify(
            g.rows[0]!.cells["slug"] || g.rows[0]!.cells["urun_adi"] || "",
          ),
        ),
      ),
    ]);
    const skuSet = new Set(takenSkus.map((s) => s.toUpperCase()));
    const slugSet = new Set(takenSlugs);

    const issues: RowIssue[] = [];
    let created = 0;

    for (const group of groups) {
      const first = group.rows[0]!;
      const slug = slugify(
        first.cells["slug"] || first.cells["urun_adi"] || "",
      );

      if (slugSet.has(slug)) {
        issues.push({
          row: first.row,
          message: `Ürün zaten var (güncelleme için toplu güncelleme kullanın): ${slug}`,
        });
        continue;
      }
      const takenSku = group.rows.find((r) =>
        skuSet.has((r.cells["sku"] ?? "").toUpperCase()),
      );
      if (takenSku) {
        issues.push({
          row: takenSku.row,
          message: `SKU zaten kayıtlı: ${takenSku.cells["sku"]}`,
        });
        continue;
      }

      const built = this.build(group, taxonomy);
      if ("error" in built) {
        issues.push({ row: built.row, message: built.error });
        continue;
      }

      try {
        if (options.dryRun) this.products.validate(built.input);
        else await this.products.create(built.input, actor);
        created++;
      } catch (error) {
        issues.push(this.toIssue(error, first.row, group));
      }
    }

    return {
      dryRun: options.dryRun,
      totalRows: records.length,
      products: groups.length,
      created: options.dryRun ? 0 : created,
      issues,
    };
  }

  private group(rows: Row[]): ProductGroup[] {
    const groups = new Map<string, ProductGroup>();
    for (const row of rows) {
      const key = groupKey(row.cells);
      const group = groups.get(key) ?? { key, rows: [] };
      group.rows.push(row);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  private build(
    group: ProductGroup,
    taxonomy: Awaited<ReturnType<ImportRepository["taxonomy"]>>,
  ): { input: unknown } | { error: string; row: number } {
    const first = group.rows[0]!;
    const c = first.cells;

    const categoryRef = (c["kategori"] ?? "").toLowerCase();
    const category = taxonomy.categories.find(
      (item) =>
        item.slug === categoryRef || item.name.toLowerCase() === categoryRef,
    );
    if (!category) {
      return { row: first.row, error: `Kategori bulunamadı: ${c["kategori"]}` };
    }

    let brandId = "";
    if (c["marka"]) {
      const brand = taxonomy.brands.find(
        (item) => item.name.toLowerCase() === c["marka"]!.toLowerCase(),
      );
      if (!brand) {
        return { row: first.row, error: `Marka bulunamadı: ${c["marka"]}` };
      }
      brandId = brand.id;
    }

    const statusKey = normalizeHeader(c["durum"] ?? "");
    const status = statusKey ? STATUS_MAP[statusKey] : "DRAFT";
    if (!status) {
      return { row: first.row, error: `Geçersiz durum: ${c["durum"]}` };
    }

    // Seçenek eksenleri: secenek1/deger1 … secenek3/deger3
    const axisNames: string[] = [];
    for (let i = 1; i <= MAX_OPTION_AXES; i++) {
      const name = first.cells[`secenek${i}`];
      if (name) axisNames.push(name);
    }
    const axisColumns = Array.from(
      { length: MAX_OPTION_AXES },
      (_, i) => i + 1,
    ).filter((i) => first.cells[`secenek${i}`]);

    const optionValues = new Map<string, string[]>();
    axisNames.forEach((name) => optionValues.set(name, []));

    const variants = group.rows.map((row) => {
      const chosen: Record<string, string> = {};
      axisColumns.forEach((column, position) => {
        const name = axisNames[position]!;
        const value = row.cells[`deger${column}`] ?? "";
        chosen[name] = value;
        const values = optionValues.get(name)!;
        if (value && !values.includes(value)) values.push(value);
      });

      return {
        sku: row.cells["sku"],
        barcode: row.cells["barkod"],
        price: row.cells["fiyat"],
        compareAtPrice: row.cells["indirimsiz_fiyat"],
        stockQuantity: row.cells["stok"],
        isActive: true,
        optionValues: chosen,
      };
    });

    return {
      input: {
        name: c["urun_adi"],
        slug: c["slug"],
        description: c["aciklama"],
        status,
        categoryId: category.id,
        brandId,
        taxRate: c["kdv"] ? c["kdv"].replace(",", ".") : DEFAULT_TAX_RATE,
        trackInventory: true,
        isFeatured: false,
        options: axisNames.map((name) => ({
          name,
          values: optionValues.get(name)!,
        })),
        variants,
        images: c["gorsel"]
          ? c["gorsel"]
              .split("|")
              .map((url) => ({ url: url.trim(), alt: c["urun_adi"] }))
              .filter((image) => image.url)
          : [],
      },
    };
  }

  private toIssue(error: unknown, row: number, group: ProductGroup): RowIssue {
    if (error instanceof ProductValidationError) {
      // "variants.2.sku" → ilgili dosya satırı
      for (const [path, message] of Object.entries(error.fieldErrors)) {
        const match = /^variants\.(\d+)/.exec(path);
        const target = match ? group.rows[Number(match[1])] : undefined;
        return { row: target?.row ?? row, message: `${path}: ${message}` };
      }
    }
    if (isAppError(error)) return { row, message: error.message };
    throw error;
  }
}
