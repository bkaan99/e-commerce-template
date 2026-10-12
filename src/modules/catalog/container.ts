import { getDb } from "@/shared/db";
import { PrismaCatalogRepository } from "./catalog.repository";
import { CatalogService } from "./catalog.service";
import { GroupPriceResolver } from "./pricing";
import { PrismaPricingRepository } from "./pricing.repository";

/** Bayi grubu ve adet kademesi fiyatlarını uygulayan paylaşılan fiyat çözücü. */
export const priceResolver = new GroupPriceResolver(
  new PrismaPricingRepository(getDb),
);

export const catalogService = new CatalogService(
  new PrismaCatalogRepository(getDb),
  priceResolver,
);
