import { getAuditLogger } from "@/shared/audit";
import { getDb } from "@/shared/db";
import { PrismaContentRepository } from "./content.repository";
import { ContentService } from "./content.service";

export function getContentService(): ContentService {
  return new ContentService(
    new PrismaContentRepository(getDb),
    getAuditLogger(),
  );
}
