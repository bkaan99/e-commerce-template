"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteCategoryAction, saveCategoryAction } from "./actions";

export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
  depth: number;
}

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  parentId: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
}

const blank: FormState = {
  id: null,
  name: "",
  slug: "",
  parentId: "",
  description: "",
  imageUrl: "",
  sortOrder: "0",
  isActive: true,
  seoTitle: "",
  seoDescription: "",
};

function fromRow(row: CategoryRow): FormState {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId ?? "",
    description: row.description ?? "",
    imageUrl: row.imageUrl ?? "",
    sortOrder: String(row.sortOrder),
    isActive: row.isActive,
    seoTitle: row.seoTitle ?? "",
    seoDescription: row.seoDescription ?? "",
  };
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [form, setForm] = useState<FormState>(blank);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  function save() {
    startTransition(async () => {
      const result = await saveCategoryAction(form.id, {
        name: form.name,
        slug: form.slug,
        parentId: form.parentId,
        description: form.description,
        imageUrl: form.imageUrl,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
      });
      if (result.ok) {
        setMessage({ text: "Kaydedildi", error: false });
        if (!form.id) setForm(blank);
      } else {
        setMessage({ text: result.error ?? "Kaydedilemedi", error: true });
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Kategori silinsin mi?")) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      setMessage(
        result.ok
          ? { text: "Silindi", error: false }
          : { text: result.error ?? "Silinemedi", error: true },
      );
      if (result.ok && form.id === id) setForm(blank);
    });
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Kategoriler</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 py-2"
                style={{ paddingLeft: `${category.depth * 20}px` }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{category.name}</span>
                  <span className="text-muted-foreground">
                    /{category.slug}
                  </span>
                  <Badge>{category.productCount} ürün</Badge>
                  {!category.isActive ? (
                    <Badge tone="warning">Pasif</Badge>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm(fromRow(category))}
                  >
                    Düzenle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => remove(category.id)}
                  >
                    Sil
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {form.id ? "Kategoriyi düzenle" : "Yeni kategori"}
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
            <Label>Adres (slug)</Label>
            <Input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="Boşsa addan üretilir"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Üst kategori</Label>
            <Select
              value={form.parentId}
              onChange={(e) => set("parentId", e.target.value)}
            >
              <option value="">Ana kategori</option>
              {categories
                .filter((category) => category.id !== form.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {"— ".repeat(category.depth)}
                    {category.name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Açıklama</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Görsel adresi</Label>
            <Input
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Sıra</Label>
            <Input
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>SEO başlığı</Label>
            <Input
              value={form.seoTitle}
              maxLength={70}
              onChange={(e) => set("seoTitle", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>SEO açıklaması</Label>
            <Textarea
              rows={2}
              maxLength={160}
              value={form.seoDescription}
              onChange={(e) => set("seoDescription", e.target.value)}
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
            <Button disabled={pending} onClick={save}>
              {pending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
            {form.id ? (
              <Button variant="outline" onClick={() => setForm(blank)}>
                Yeni kategori
              </Button>
            ) : null}
          </div>
          {message ? (
            <p
              role={message.error ? "alert" : "status"}
              className={
                message.error
                  ? "text-sm text-red-600"
                  : "text-sm text-green-700"
              }
            >
              {message.text}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
