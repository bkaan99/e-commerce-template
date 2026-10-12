import { z } from "zod";
import type { ErpConnector, ErpStockRecord } from "./erp.types";

const responseSchema = z.array(
  z.object({
    sku: z.string(),
    stock: z.number(),
    price: z.union([z.string(), z.number()]).optional(),
  }),
);

/**
 * Genel amaçlı JSON bağlayıcı: ERP'nin (veya aracı servisin) şu biçimde bir
 * uç nokta sunduğunu varsayar: GET → [{ "sku": "...", "stock": 5, "price": 99.9 }].
 * Farklı bir biçim için kendi ErpConnector uygulamanızı yazın.
 */
export class HttpJsonErpConnector implements ErpConnector {
  readonly name = "http-json";

  constructor(
    private readonly url: string,
    private readonly apiKey?: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async fetchStock(): Promise<ErpStockRecord[]> {
    const response = await fetch(this.url, {
      headers: {
        Accept: "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`ERP isteği başarısız: HTTP ${response.status}`);
    }

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("ERP yanıtı beklenen biçimde değil");
    }

    return parsed.data.map((row) => ({
      sku: row.sku,
      stockQuantity: row.stock,
      ...(row.price !== undefined
        ? { price: Number(row.price).toFixed(2) }
        : {}),
    }));
  }
}
