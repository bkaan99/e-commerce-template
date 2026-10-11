import { getDb } from "@/shared/db";
import { PrismaCatalogRepository } from "./catalog.repository";
import { CatalogService } from "./catalog.service";
import { RetailPriceResolver } from "./pricing";

export const catalogService = new CatalogService(
  new PrismaCatalogRepository(getDb),
  new RetailPriceResolver(),
);
