"use client";

import { CARRIER_NAMES } from "@/shared/shipping/carriers";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  cancelOrderByStaffAction,
  confirmBankTransferAction,
  markDeferredCollectedAction,
  markDeliveredAction,
  markProcessingAction,
  shipOrderAction,
} from "../actions";

export function OrderActions({
  orderNumber,
  canProcess,
  canShip,
  canDeliver,
  canCancel,
  canConfirmBankTransfer,
  canCollectDeferred,
  paid,
}: {
  orderNumber: string;
  canProcess: boolean;
  canShip: boolean;
  canDeliver: boolean;
  canCancel: boolean;
  canConfirmBankTransfer: boolean;
  canCollectDeferred: boolean;
  paid: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : (result.error ?? "İşlem başarısız"));
    });
  }

  function cancel() {
    const message = paid
      ? "Sipariş iptal edilsin ve ödeme müşteriye iade edilsin mi?"
      : "Sipariş iptal edilsin mi?";
    if (window.confirm(message))
      run(() => cancelOrderByStaffAction(orderNumber));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {canProcess ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => markProcessingAction(orderNumber))}
          >
            Hazırlanıyor olarak işaretle
          </Button>
        ) : null}
        {canConfirmBankTransfer ? (
          <Button
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  "Havale/EFT hesaba geçti mi? Sipariş ödenmiş sayılacak.",
                )
              ) {
                run(() => confirmBankTransferAction(orderNumber));
              }
            }}
          >
            Havale alındı
          </Button>
        ) : null}
        {canCollectDeferred ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  "Vadeli ödeme tahsil edildi olarak işaretlensin mi?",
                )
              ) {
                run(() => markDeferredCollectedAction(orderNumber));
              }
            }}
          >
            Tahsil edildi
          </Button>
        ) : null}
        {canDeliver ? (
          <Button
            disabled={pending}
            onClick={() => run(() => markDeliveredAction(orderNumber))}
          >
            Teslim edildi
          </Button>
        ) : null}
        {canCancel ? (
          <Button variant="destructive" disabled={pending} onClick={cancel}>
            Siparişi iptal et
          </Button>
        ) : null}
      </div>

      {canShip ? (
        <form
          className="flex flex-wrap items-end gap-2"
          action={(formData) =>
            run(() =>
              shipOrderAction(
                orderNumber,
                String(formData.get("carrier") ?? ""),
                String(formData.get("trackingNumber") ?? ""),
              ),
            )
          }
        >
          <label className="flex flex-col gap-1 text-sm">
            Kargo firması
            <Select
              name="carrier"
              defaultValue={CARRIER_NAMES[0]}
              className="w-48"
            >
              {CARRIER_NAMES.map((carrier) => (
                <option key={carrier} value={carrier}>
                  {carrier}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Takip numarası
            <Input name="trackingNumber" className="w-56" />
          </label>
          <Button type="submit" disabled={pending}>
            Kargoya ver
          </Button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
