import { formatMoney } from "@/shared/money";

export function Price({
  value,
  compareAt,
  currency = "TRY",
  prefix,
}: {
  value: string;
  compareAt?: string | null;
  currency?: string;
  prefix?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-2">
      {prefix ? (
        <span className="text-xs text-muted-foreground">{prefix}</span>
      ) : null}
      <span className="font-semibold">{formatMoney(value, currency)}</span>
      {compareAt ? (
        <span className="text-sm text-muted-foreground line-through">
          {formatMoney(compareAt, currency)}
        </span>
      ) : null}
    </span>
  );
}
