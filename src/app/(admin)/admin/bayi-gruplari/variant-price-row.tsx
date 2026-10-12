"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatTierText,
  parseTierText,
} from "@/modules/admin/pricing/price-list.schema";
import { setGroupPriceAction, setTiersAction } from "./actions";

export interface VariantRowData {
  variantId: string;
  sku: string;
  productName: string;
  optionLabel: string;
  listPrice: string;
  groupPrice: string | null;
  groupTiers: { minQuantity: number; price: string }[];
  generalTiers: { minQuantity: number; price: string }[];
}

export function VariantPriceRow({
  groupId,
  row,
}: {
  groupId: string;
  row: VariantRowData;
}) {
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(
    row.groupPrice ? String(Number(row.groupPrice)) : "",
  );
  const [tiers, setTiers] = useState(formatTierText(row.groupTiers));
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  function save() {
    startTransition(async () => {
      const priceResult = await setGroupPriceAction(
        groupId,
        row.variantId,
        price,
      );
      if (!priceResult.ok) {
        setMessage({
          text: priceResult.error ?? "Fiyat kaydedilemedi",
          error: true,
        });
        return;
      }

      const tierResult = await setTiersAction(
        groupId,
        row.variantId,
        parseTierText(tiers),
      );
      setMessage(
        tierResult.ok
          ? { text: "Kaydedildi", error: false }
          : {
              text: tierResult.error ?? "Kademeler kaydedilemedi",
              error: true,
            },
      );
    });
  }

  return (
    <tr className="align-top">
      <td className="px-3 py-3">
        <div className="font-medium">{row.productName}</div>
        <div className="text-xs text-muted-foreground">
          {row.sku}
          {row.optionLabel ? ` · ${row.optionLabel}` : ""}
        </div>
      </td>
      <td className="px-3 py-3">{row.listPrice} TL</td>
      <td className="px-3 py-3">
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder="Liste/iskonto"
          aria-label={`${row.sku} grup fiyatı`}
          className="w-32"
        />
      </td>
      <td className="px-3 py-3">
        <Input
          value={tiers}
          onChange={(e) => setTiers(e.target.value)}
          placeholder="10:90, 50:75"
          aria-label={`${row.sku} adet kademeleri`}
          className="w-44"
        />
        {row.generalTiers.length > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Genel kademe: {formatTierText(row.generalTiers)}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <Button size="sm" disabled={pending} onClick={save}>
          Kaydet
        </Button>
        {message ? (
          <p
            role={message.error ? "alert" : "status"}
            className={
              message.error
                ? "mt-1 text-xs text-red-600"
                : "mt-1 text-xs text-green-700"
            }
          >
            {message.text}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
