import { connection } from "next/server";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/shared/site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/sepet", "/giris", "/ara", "/favoriler"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
