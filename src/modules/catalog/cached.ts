import "server-only";
import { cache } from "react";
import { catalogService } from "./container";

/**
 * Kategori ağacı; aynı istek içinde birden çok bileşen (menü, ana sayfa)
 * kullandığında tek sorgu yapılır. `use cache` bilinçli olarak kullanılmaz:
 * build sırasında veritabanı gerektirirdi.
 */
export const getCategoryTree = cache(() => catalogService.getCategoryTree());
