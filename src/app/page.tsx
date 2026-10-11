import { siteConfig } from "@/config/site.config";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">{siteConfig.name}</h1>
      <p className="text-muted-foreground">{siteConfig.description}</p>
      <span className="rounded-theme bg-primary px-4 py-2 text-primary-foreground">
        v0.1 iskelet
      </span>
    </main>
  );
}
