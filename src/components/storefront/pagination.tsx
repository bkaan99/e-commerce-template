import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const link = "rounded-theme border border-border px-3 py-2 text-sm";

  return (
    <nav
      aria-label="Sayfalama"
      className="flex items-center justify-center gap-2"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={link} rel="prev">
          Önceki
        </Link>
      ) : null}
      <span className="px-2 text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={link} rel="next">
          Sonraki
        </Link>
      ) : null}
    </nav>
  );
}
