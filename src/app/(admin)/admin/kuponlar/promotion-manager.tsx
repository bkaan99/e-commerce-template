"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  deleteCampaignAction,
  deleteCouponAction,
  saveCampaignAction,
  saveCouponAction,
} from "./actions";

export interface CouponRow {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: string;
  minSubtotal: string | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export interface CampaignRow {
  id: string;
  name: string;
  ruleType: string;
  type: "PERCENT" | "FIXED";
  value: number;
  categoryIds: string[];
  minSubtotal: number | null;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

function useRunner() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { text: "Kaydedildi", error: false }
          : { text: result.error ?? "İşlem başarısız", error: true },
      );
      if (result.ok) onDone?.();
    });
  }

  return { pending, message, run };
}

function Message({
  message,
}: {
  message: { text: string; error: boolean } | null;
}) {
  if (!message) return null;
  return (
    <p
      role={message.error ? "alert" : "status"}
      className={
        message.error ? "text-sm text-red-600" : "text-sm text-green-700"
      }
    >
      {message.text}
    </p>
  );
}

function CouponSection({ coupons }: { coupons: CouponRow[] }) {
  const { pending, message, run } = useRunner();
  const blank = {
    id: null as string | null,
    code: "",
    type: "PERCENT",
    value: "",
    minSubtotal: "",
    maxUses: "",
    perCustomerLimit: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
  };
  const [form, setForm] = useState(blank);
  const set = <K extends keyof typeof blank>(
    key: K,
    value: (typeof blank)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Kupon kodları</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {coupons.map((coupon) => (
              <li
                key={coupon.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{coupon.code}</span>
                  <span>
                    {coupon.type === "PERCENT"
                      ? `%${Number(coupon.value)}`
                      : `${coupon.value} TL`}
                  </span>
                  <Badge>
                    {coupon.usedCount}
                    {coupon.maxUses ? ` / ${coupon.maxUses}` : ""} kullanım
                  </Badge>
                  {!coupon.isActive ? (
                    <Badge tone="warning">Pasif</Badge>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: coupon.id,
                        code: coupon.code,
                        type: coupon.type,
                        value: String(Number(coupon.value)),
                        minSubtotal: coupon.minSubtotal
                          ? String(Number(coupon.minSubtotal))
                          : "",
                        maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
                        perCustomerLimit: coupon.perCustomerLimit
                          ? String(coupon.perCustomerLimit)
                          : "",
                        startsAt: toLocalInput(coupon.startsAt),
                        endsAt: toLocalInput(coupon.endsAt),
                        isActive: coupon.isActive,
                      })
                    }
                  >
                    Düzenle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`${coupon.code} silinsin mi?`)) {
                        run(() => deleteCouponAction(coupon.id));
                      }
                    }}
                  >
                    Sil
                  </Button>
                </div>
              </li>
            ))}
            {coupons.length === 0 ? (
              <li className="py-4 text-muted-foreground">Henüz kupon yok.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Kuponu düzenle" : "Yeni kupon"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Kod</Label>
            <Input
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              className="uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label>Tür</Label>
              <Select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                <option value="PERCENT">Yüzde</option>
                <option value="FIXED">Sabit tutar</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Değer</Label>
              <Input
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Minimum sepet tutarı</Label>
            <Input
              value={form.minSubtotal}
              onChange={(e) => set("minSubtotal", e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label>Toplam kullanım</Label>
              <Input
                value={form.maxUses}
                onChange={(e) => set("maxUses", e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Müşteri başına</Label>
              <Input
                value={form.perCustomerLimit}
                onChange={(e) => set("perCustomerLimit", e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Başlangıç</Label>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Bitiş</Label>
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            Aktif
          </label>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => saveCouponAction(form.id, form),
                  () => !form.id && setForm(blank),
                )
              }
            >
              Kaydet
            </Button>
            {form.id ? (
              <Button variant="outline" onClick={() => setForm(blank)}>
                Yeni kupon
              </Button>
            ) : null}
          </div>
          <Message message={message} />
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignSection({
  campaigns,
  categories,
}: {
  campaigns: CampaignRow[];
  categories: { id: string; label: string }[];
}) {
  const { pending, message, run } = useRunner();
  const blank = {
    id: null as string | null,
    name: "",
    ruleType: "cart-threshold",
    type: "PERCENT",
    value: "",
    categoryIds: [] as string[],
    minSubtotal: "",
    priority: "0",
    startsAt: "",
    endsAt: "",
    isActive: true,
  };
  const [form, setForm] = useState(blank);
  const set = <K extends keyof typeof blank>(
    key: K,
    value: (typeof blank)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const describe = (campaign: CampaignRow) => {
    const amount =
      campaign.type === "PERCENT"
        ? `%${campaign.value}`
        : `${campaign.value} TL`;
    return campaign.ruleType === "category"
      ? `${amount} · ${campaign.categoryIds.length} kategori`
      : `${amount} · ${campaign.minSubtotal ?? 0} TL üzeri sepet`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Otomatik kampanyalar</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {campaigns.map((campaign) => (
              <li
                key={campaign.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{campaign.name}</span>
                  <span className="text-muted-foreground">
                    {describe(campaign)}
                  </span>
                  {!campaign.isActive ? (
                    <Badge tone="warning">Pasif</Badge>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: campaign.id,
                        name: campaign.name,
                        ruleType: campaign.ruleType,
                        type: campaign.type,
                        value: String(campaign.value),
                        categoryIds: campaign.categoryIds,
                        minSubtotal:
                          campaign.minSubtotal === null
                            ? ""
                            : String(campaign.minSubtotal),
                        priority: String(campaign.priority),
                        startsAt: toLocalInput(campaign.startsAt),
                        endsAt: toLocalInput(campaign.endsAt),
                        isActive: campaign.isActive,
                      })
                    }
                  >
                    Düzenle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`${campaign.name} silinsin mi?`)) {
                        run(() => deleteCampaignAction(campaign.id));
                      }
                    }}
                  >
                    Sil
                  </Button>
                </div>
              </li>
            ))}
            {campaigns.length === 0 ? (
              <li className="py-4 text-muted-foreground">
                Henüz kampanya yok.
              </li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {form.id ? "Kampanyayı düzenle" : "Yeni kampanya"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Ad</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Kural</Label>
            <Select
              value={form.ruleType}
              onChange={(e) => set("ruleType", e.target.value)}
            >
              <option value="cart-threshold">Sepet tutarına göre</option>
              <option value="category">Kategoriye göre</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label>Tür</Label>
              <Select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                <option value="PERCENT">Yüzde</option>
                <option value="FIXED">Sabit tutar</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Değer</Label>
              <Input
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
          {form.ruleType === "cart-threshold" ? (
            <div className="flex flex-col gap-1">
              <Label>Minimum sepet tutarı</Label>
              <Input
                value={form.minSubtotal}
                onChange={(e) => set("minSubtotal", e.target.value)}
                inputMode="decimal"
              />
            </div>
          ) : (
            <fieldset className="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
              <legend className="mb-1 font-medium">Kategoriler</legend>
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(category.id)}
                    onChange={() =>
                      set(
                        "categoryIds",
                        form.categoryIds.includes(category.id)
                          ? form.categoryIds.filter((id) => id !== category.id)
                          : [...form.categoryIds, category.id],
                      )
                    }
                  />
                  {category.label}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex flex-col gap-1">
            <Label>Öncelik</Label>
            <Input
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Başlangıç</Label>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Bitiş</Label>
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            Aktif
          </label>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => saveCampaignAction(form.id, form),
                  () => !form.id && setForm(blank),
                )
              }
            >
              Kaydet
            </Button>
            {form.id ? (
              <Button variant="outline" onClick={() => setForm(blank)}>
                Yeni kampanya
              </Button>
            ) : null}
          </div>
          <Message message={message} />
        </CardContent>
      </Card>
    </div>
  );
}

export function PromotionManager({
  coupons,
  campaigns,
  categories,
}: {
  coupons: CouponRow[];
  campaigns: CampaignRow[];
  categories: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-10">
      <CouponSection coupons={coupons} />
      <CampaignSection campaigns={campaigns} categories={categories} />
    </div>
  );
}
