"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSION_GROUPS } from "@/shared/permissions";
import { deleteRoleAction, saveRoleAction } from "./actions";

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

const LABELS = new Map(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((p) => [p.key, p.label] as const),
  ),
);

export function RoleManager({
  roles,
  grantable,
}: {
  roles: RoleView[];
  /** İşlemi yapanın verebileceği yetkiler (kendi yetkileri) */
  grantable: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setDescription("");
    setSelected([]);
  }

  function toggle(permission: string) {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );
  }

  function save() {
    startTransition(async () => {
      const result = await saveRoleAction(editingId, {
        name,
        description,
        permissions: selected,
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
    if (!window.confirm("Rol silinsin mi?")) return;
    startTransition(async () => {
      const result = await deleteRoleAction(id);
      setMessage(
        result.ok
          ? { text: "Silindi", error: false }
          : { text: result.error ?? "Silinemedi", error: true },
      );
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Roller</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {roles.map((role) => (
              <li key={role.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{role.name}</span>
                    {role.isSystem ? <Badge>Sistem</Badge> : null}
                    <span className="text-muted-foreground">
                      {role.userCount} personel
                    </span>
                  </div>
                  {!role.isSystem ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(role.id);
                          setName(role.name);
                          setDescription(role.description ?? "");
                          setSelected(role.permissions);
                        }}
                      >
                        Düzenle
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => remove(role.id)}
                      >
                        Sil
                      </Button>
                    </div>
                  ) : null}
                </div>
                {role.description ? (
                  <p className="text-muted-foreground">{role.description}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {role.permissions
                    .map(
                      (permission) =>
                        LABELS.get(permission as never) ?? permission,
                    )
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Rolü düzenle" : "Yeni rol"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="role-name">Rol adı</Label>
            <Input
              id="role-name"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="role-description">Açıklama</Label>
            <Input
              id="role-description"
              value={description}
              maxLength={200}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {PERMISSION_GROUPS.map((group) => (
            <fieldset key={group.label} className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">
                {group.label}
              </legend>
              {group.permissions.map((permission) => {
                const allowed = grantable.includes(permission.key);
                return (
                  <label
                    key={permission.key}
                    className={`flex items-center gap-2 text-sm ${
                      allowed ? "" : "opacity-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(permission.key)}
                      disabled={!allowed}
                      onChange={() => toggle(permission.key)}
                    />
                    {permission.label}
                  </label>
                );
              })}
            </fieldset>
          ))}

          {message ? (
            <p
              role={message.error ? "alert" : "status"}
              className={`text-sm ${message.error ? "text-red-600" : "text-green-700"}`}
            >
              {message.text}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={save} disabled={pending}>
              {editingId ? "Güncelle" : "Rol oluştur"}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={reset} disabled={pending}>
                Vazgeç
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
