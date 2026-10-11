import type { Features } from "./features";
import type { SalesMode, SiteConfig } from "./site.config";
import type { Theme } from "./theme";
import projectJson from "./project.json";

/**
 * Projeye özel değerler `project.json` içinde tutulur ve varsayılanların
 * üzerine yazılır. `npm run init-project` bu dosyayı üretir.
 */
export interface ProjectConfig {
  site?: {
    name?: string;
    description?: string;
    salesMode?: SalesMode;
    contact?: Partial<SiteConfig["contact"]>;
  };
  features?: Partial<Features>;
  theme?: { colors?: Partial<Theme["colors"]> };
}

export const projectConfig: ProjectConfig = projectJson as ProjectConfig;
