"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  approveDealerAction,
  rejectDealerAction,
  updateDealerTermsAction,
} from "./actions";

export interface DealerRowData {
  userId: string;
  name: string;
  email: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "NONE";
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  groupId: string | null;
  groupName: string | null;
  creditLimit: string | null;
  minOrderAmount: string | null;
  note: string | null;
}

const STATUS_LABELS = {
  PENDING: "Bekliyor",
  APPROVED: "Onaylı",
  REJECTED: "Reddedildi",
  NONE: "–",
} as const;

const TONES = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  NONE: "neutral",
} as const;

export function DealerRow({
  dealer,
  groups,
}: {
  dealer: DealerRowData;
  groups: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState(dealer.groupId ?? groups[0]?.id ?? "");
  const [creditLimit, setCreditLimit] = useState(
    dealer.creditLimit ? String(Number(dealer.creditLimit)) : "",
  );
  const [minOrder, setMinOrder] = useState(
    dealer.minOrderAmount ? String(Number(dealer.minOrderAmount)) : "",
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { text: "Kaydedildi", error: false }
          : { text: result.error ?? "İşlem başarısız", error: true },
      );
    });
  }

  const terms = { groupId, creditLimit, minOrderAmount: minOrder };

  return (
    <li className="flex flex-col gap-3 rounded-theme border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{dealer.companyName ?? "–"}</span>
        <Badge tone={TONES[dealer.status]}>
          {STATUS_LABELS[dealer.status]}
        </Badge>
        {dealer.groupName ? <Badge>{dealer.groupName}</Badge> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {dealer.name} · {dealer.email} · VKN {dealer.taxNumber ?? "–"} (
        {dealer.taxOffice ?? "–"})
      </p>
      {dealer.note ? <p className="text-sm">Not: {dealer.note}</p> : null}

      <div className="grid gap-2 sm:grid-cols-[180px_160px_160px_auto]">
        <Select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          aria-label="Müşteri grubu"
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
        <Input
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          placeholder="Kredi limiti (TL)"
          inputMode="decimal"
          aria-label="Kredi limiti"
        />
        <Input
          value={minOrder}
          onChange={(e) => setMinOrder(e.target.value)}
          placeholder="Min. sipariş (TL)"
          inputMode="decimal"
          aria-label="Minimum sipariş tutarı"
        />
        {dealer.status === "APPROVED" ? (
          <Button
            disabled={pending}
            onClick={() =>
              run(() => updateDealerTermsAction(dealer.userId, terms))
            }
          >
            Koşulları güncelle
          </Button>
        ) : (
          <Button
            disabled={pending || !groupId}
            onClick={() => run(() => approveDealerAction(dealer.userId, terms))}
          >
            Onayla
          </Button>
        )}
      </div>

      {dealer.status !== "APPROVED" ? (
        <div className="flex flex-wrap gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Red nedeni (isteğe bağlı)"
            className="max-w-sm"
            aria-label="Red nedeni"
          />
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => rejectDealerAction(dealer.userId, note))}
          >
            Reddet
          </Button>
        </div>
      ) : (
        <div>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Bayilik iptal edilsin mi?")) {
                run(() =>
                  rejectDealerAction(dealer.userId, "Bayilik sonlandırıldı"),
                );
              }
            }}
          >
            Bayiliği sonlandır
          </Button>
        </div>
      )}

      {message ? (
        <p
          role={message.error ? "alert" : "status"}
          className={
            message.error ? "text-sm text-red-600" : "text-sm text-green-700"
          }
        >
          {message.text}
        </p>
      ) : null}
    </li>
  );
}
