import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
      <p className="text-muted-foreground">
        Aradığınız sayfa taşınmış veya kaldırılmış olabilir.
      </p>
      <Link
        href="/"
        className="rounded-theme bg-primary px-5 py-2 text-primary-foreground"
      >
        Ana sayfaya dön
      </Link>
    </main>
  );
}
