"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteBannerAction,
  deletePageAction,
  saveBannerAction,
  saveMenuAction,
  savePageAction,
} from "./actions";

export interface BannerRow {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export interface PageRow {
  id: string;
  title: string;
  slug: string;
  content: string;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface MenuItemRow {
  label: string;
  url: string;
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

function BannerSection({ banners }: { banners: BannerRow[] }) {
  const { pending, message, run } = useRunner();
  const blank = {
    id: null as string | null,
    title: "",
    imageUrl: "",
    linkUrl: "",
    sortOrder: "0",
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
          <CardTitle>Ana sayfa bannerları</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {banners.map((banner) => (
              <li
                key={banner.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{banner.title}</span>
                  <span className="text-muted-foreground">
                    sıra {banner.sortOrder}
                  </span>
                  {!banner.isActive ? (
                    <Badge tone="warning">Pasif</Badge>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: banner.id,
                        title: banner.title,
                        imageUrl: banner.imageUrl,
                        linkUrl: banner.linkUrl ?? "",
                        sortOrder: String(banner.sortOrder),
                        startsAt: toLocalInput(banner.startsAt),
                        endsAt: toLocalInput(banner.endsAt),
                        isActive: banner.isActive,
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
                      if (window.confirm("Banner silinsin mi?"))
                        run(() => deleteBannerAction(banner.id));
                    }}
                  >
                    Sil
                  </Button>
                </div>
              </li>
            ))}
            {banners.length === 0 ? (
              <li className="py-4 text-muted-foreground">Banner yok.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Banner düzenle" : "Yeni banner"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Başlık</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Görsel adresi</Label>
            <Input
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="https://… veya /yol"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Bağlantı (isteğe bağlı)</Label>
            <Input
              value={form.linkUrl}
              onChange={(e) => set("linkUrl", e.target.value)}
              placeholder="/kategori/giyim"
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
            <Label>Yayın başlangıcı</Label>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Yayın bitişi</Label>
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
                  () => saveBannerAction(form.id, form),
                  () => !form.id && setForm(blank),
                )
              }
            >
              Kaydet
            </Button>
            {form.id ? (
              <Button variant="outline" onClick={() => setForm(blank)}>
                Yeni banner
              </Button>
            ) : null}
          </div>
          <Message message={message} />
        </CardContent>
      </Card>
    </div>
  );
}

function PageSection({ pages }: { pages: PageRow[] }) {
  const { pending, message, run } = useRunner();
  const blank = {
    id: null as string | null,
    title: "",
    slug: "",
    content: "",
    isPublished: false,
    seoTitle: "",
    seoDescription: "",
  };
  const [form, setForm] = useState(blank);
  const set = <K extends keyof typeof blank>(
    key: K,
    value: (typeof blank)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Sayfalar</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {pages.map((page) => (
              <li
                key={page.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{page.title}</span>
                  <span className="text-xs text-muted-foreground">
                    /sayfa/{page.slug}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge tone={page.isPublished ? "success" : "warning"}>
                    {page.isPublished ? "Yayında" : "Taslak"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: page.id,
                        title: page.title,
                        slug: page.slug,
                        content: page.content,
                        isPublished: page.isPublished,
                        seoTitle: page.seoTitle ?? "",
                        seoDescription: page.seoDescription ?? "",
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
                      if (window.confirm(`"${page.title}" silinsin mi?`))
                        run(() => deletePageAction(page.id));
                    }}
                  >
                    Sil
                  </Button>
                </div>
              </li>
            ))}
            {pages.length === 0 ? (
              <li className="py-4 text-muted-foreground">Sayfa yok.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Sayfayı düzenle" : "Yeni sayfa"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label>Başlık</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Adres (slug)</Label>
              <Input
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="Boşsa başlıktan üretilir"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>İçerik</Label>
            <Textarea
              rows={14}
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              # Başlık, ## Alt başlık, - liste, **kalın**, [metin](/adres) ve
              boş satırla paragraf kullanabilirsiniz. HTML desteklenmez.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
              <Input
                value={form.seoDescription}
                maxLength={160}
                onChange={(e) => set("seoDescription", e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => set("isPublished", e.target.checked)}
            />
            Yayında
          </label>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => savePageAction(form.id, form),
                  () => !form.id && setForm(blank),
                )
              }
            >
              Kaydet
            </Button>
            {form.id ? (
              <Button variant="outline" onClick={() => setForm(blank)}>
                Yeni sayfa
              </Button>
            ) : null}
          </div>
          <Message message={message} />
        </CardContent>
      </Card>
    </div>
  );
}

function MenuEditor({
  menuKey,
  title,
  initial,
}: {
  menuKey: "header" | "footer";
  title: string;
  initial: MenuItemRow[];
}) {
  const { pending, message, run } = useRunner();
  const [items, setItems] = useState<MenuItemRow[]>(initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={item.label}
              placeholder="Etiket"
              aria-label="Etiket"
              onChange={(e) =>
                setItems((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, label: e.target.value } : r,
                  ),
                )
              }
            />
            <Input
              value={item.url}
              placeholder="/sayfa/hakkimizda"
              aria-label="Adres"
              onChange={(e) =>
                setItems((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, url: e.target.value } : r,
                  ),
                )
              }
            />
            <Button
              variant="ghost"
              onClick={() =>
                setItems((rows) => rows.filter((_, i) => i !== index))
              }
            >
              Kaldır
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setItems((rows) => [...rows, { label: "", url: "" }])
            }
          >
            Öğe ekle
          </Button>
          <Button
            disabled={pending}
            onClick={() => run(() => saveMenuAction({ key: menuKey, items }))}
          >
            Kaydet
          </Button>
        </div>
        <Message message={message} />
      </CardContent>
    </Card>
  );
}

export function ContentManager({
  banners,
  pages,
  headerMenu,
  footerMenu,
}: {
  banners: BannerRow[];
  pages: PageRow[];
  headerMenu: MenuItemRow[];
  footerMenu: MenuItemRow[];
}) {
  return (
    <div className="flex flex-col gap-10">
      <BannerSection banners={banners} />
      <PageSection pages={pages} />
      <div className="grid gap-6 lg:grid-cols-2">
        <MenuEditor
          menuKey="header"
          title="Üst menü ek bağlantıları"
          initial={headerMenu}
        />
        <MenuEditor
          menuKey="footer"
          title="Alt menü (footer)"
          initial={footerMenu}
        />
      </div>
    </div>
  );
}
