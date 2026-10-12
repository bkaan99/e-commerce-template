"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteStaffAction,
  resendInviteAction,
  setStaffActiveAction,
  setStaffRolesAction,
} from "./actions";

export interface StaffView {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  hasPassword: boolean;
  roleIds: string[];
  isSelf: boolean;
}

export interface RoleOption {
  id: string;
  name: string;
}

function RoleChecklist({
  roles,
  value,
  onChange,
  disabled,
}: {
  roles: RoleOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {roles.map((role) => (
        <label key={role.id} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value.includes(role.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, role.id]
                  : value.filter((id) => id !== role.id),
              )
            }
          />
          {role.name}
        </label>
      ))}
    </div>
  );
}

function StaffRow({
  member,
  roles,
  run,
  pending,
}: {
  member: StaffView;
  roles: RoleOption[];
  run: (
    task: () => Promise<{ ok: boolean; error?: string }>,
    ok: string,
  ) => void;
  pending: boolean;
}) {
  const [roleIds, setRoleIds] = useState(member.roleIds);
  const changed =
    roleIds.length !== member.roleIds.length ||
    roleIds.some((id) => !member.roleIds.includes(id));

  return (
    <li className="flex flex-col gap-2 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{member.name}</span>
          <span className="text-muted-foreground">{member.email}</span>
          {member.isSelf ? <Badge>Siz</Badge> : null}
          {!member.isActive ? <Badge tone="warning">Pasif</Badge> : null}
          {!member.hasPassword ? (
            <Badge tone="warning">Davet bekliyor</Badge>
          ) : null}
        </div>
        {!member.isSelf ? (
          <div className="flex gap-1">
            {!member.hasPassword ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() => resendInviteAction(member.id), "Davet gönderildi")
                }
              >
                Daveti tekrar gönder
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  () => setStaffActiveAction(member.id, !member.isActive),
                  member.isActive ? "Pasifleştirildi" : "Etkinleştirildi",
                )
              }
            >
              {member.isActive ? "Pasifleştir" : "Etkinleştir"}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RoleChecklist
          roles={roles}
          value={roleIds}
          onChange={setRoleIds}
          disabled={member.isSelf || pending}
        />
        {changed ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                () => setStaffRolesAction(member.id, roleIds),
                "Roller güncellendi",
              )
            }
          >
            Kaydet
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function StaffManager({
  staff,
  roles,
}: {
  staff: StaffView[];
  roles: RoleOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);

  function run(
    task: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await task();
      setMessage(
        result.ok
          ? { text: success, error: false }
          : { text: result.error ?? "İşlem tamamlanamadı", error: true },
      );
    });
  }

  function invite() {
    startTransition(async () => {
      const result = await inviteStaffAction({
        email,
        firstName,
        lastName,
        roleIds,
      });
      setMessage(
        result.ok
          ? {
              text: "Personel eklendi; parola belirleme bağlantısı e-posta ile gönderildi.",
              error: false,
            }
          : { text: result.error ?? "Eklenemedi", error: true },
      );
      if (result.ok) {
        setEmail("");
        setFirstName("");
        setLastName("");
        setRoleIds([]);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Personel</CardTitle>
        </CardHeader>
        <CardContent>
          {message ? (
            <p
              role={message.error ? "alert" : "status"}
              className={`mb-2 text-sm ${message.error ? "text-red-600" : "text-green-700"}`}
            >
              {message.text}
            </p>
          ) : null}
          <ul className="flex flex-col divide-y divide-border">
            {staff.map((member) => (
              <StaffRow
                key={`${member.id}-${member.roleIds.join(",")}`}
                member={member}
                roles={roles}
                run={run}
                pending={pending}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personel ekle</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="staff-first">Ad</Label>
            <Input
              id="staff-first"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="staff-last">Soyad</Label>
            <Input
              id="staff-last"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="staff-email">E-posta</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm">Roller</span>
            <RoleChecklist
              roles={roles}
              value={roleIds}
              onChange={setRoleIds}
              disabled={pending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Kişiye parola belirleme bağlantısı e-posta ile gönderilir.
          </p>
          <Button onClick={invite} disabled={pending}>
            Personel ekle
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
