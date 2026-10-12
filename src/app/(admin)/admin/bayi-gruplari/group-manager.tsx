"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteGroupAction, saveGroupAction } from "./actions";

export interface GroupView {
  id: string;
  name: string;
  discountPercent: string | null;
  customerCount: number;
}

export function GroupManager({
  groups,
  selectedId,
}: {
  groups: GroupView[];
  selectedId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [discount, setDiscount] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setDiscount("");
  }

  function save() {
    startTransition(async () => {
      const result = await saveGroupAction(editingId, {
        name,
        discountPercent: discount,
      });
      setMessage(
        result.ok
          ? { text: "Kaydedildi", error: false }
          : { text: result.error ?? "Kaydedilemedi", error: true },
      );
      if (result.ok) reset();
    });
  }

  function remove(id: string) {
    if (!window.confirm("Grup silinsin mi?")) return;
    startTransition(async () => {
      const result = await deleteGroupAction(id);
      setMessage(
        result.ok
          ? { text: "Silindi", error: false }
          : { text: result.error ?? "Silinemedi", error: true },
      );
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader>
          <CardTitle>Müşteri grupları</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/bayi-gruplari?grup=${group.id}`}
                    className={
                      selectedId === group.id
                        ? "font-semibold underline"
                        : "font-medium"
                    }
                  >
                    {group.name}
                  </Link>
                  <Badge>
                    {group.discountPercent
                      ? `%${Number(group.discountPercent)} iskonto`
                      : "iskonto yok"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {group.customerCount} bayi
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(group.id);
                      setName(group.name);
                      setDiscount(
                        group.discountPercent
                          ? String(Number(group.discountPercent))
                          : "",
                      );
                    }}
                  >
                    Düzenle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => remove(group.id)}
                  >
                    Sil
                  </Button>
                </div>
              </li>
            ))}
            {groups.length === 0 ? (
              <li className="py-4 text-muted-foreground">Henüz grup yok.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Grubu düzenle" : "Yeni grup"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Ad</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Genel iskonto (%)</Label>
            <Input
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              inputMode="decimal"
              placeholder="Örn. 20"
            />
          </div>
          <div className="flex gap-2">
            <Button disabled={pending || !name.trim()} onClick={save}>
              Kaydet
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={reset}>
                Vazgeç
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
