"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addAttributeValueAction,
  createBrandAction,
  deleteAttributeAction,
  deleteAttributeValueAction,
  deleteBrandAction,
  saveAttributeAction,
} from "./actions";

export interface AttributeView {
  id: string;
  name: string;
  isFilterable: boolean;
  values: { id: string; value: string; productCount: number }[];
}

export interface BrandView {
  id: string;
  name: string;
  productCount: number;
}

function useRunner() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : (result.error ?? "İşlem başarısız"));
      if (result.ok) onDone?.();
    });
  }

  return { pending, error, run };
}

function AttributeCard({ attribute }: { attribute: AttributeView }) {
  const { pending, error, run } = useRunner();
  const [value, setValue] = useState("");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>{attribute.name}</CardTitle>
          {attribute.isFilterable ? <Badge tone="info">Filtre</Badge> : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`"${attribute.name}" niteliği silinsin mi?`)) {
              run(() => deleteAttributeAction(attribute.id));
            }
          }}
        >
          Sil
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2">
          {attribute.values.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm"
            >
              {item.value}
              <span className="text-xs text-muted-foreground">
                ({item.productCount})
              </span>
              <button
                type="button"
                aria-label={`${item.value} değerini sil`}
                disabled={pending}
                onClick={() => run(() => deleteAttributeValueAction(item.id))}
                className="text-muted-foreground hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => addAttributeValueAction(attribute.id, value),
              () => setValue(""),
            );
          }}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Yeni değer"
            aria-label="Yeni değer"
            className="max-w-xs"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={pending || !value.trim()}
          >
            Ekle
          </Button>
        </form>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AttributeManager({
  attributes,
  brands,
}: {
  attributes: AttributeView[];
  brands: BrandView[];
}) {
  const attrRunner = useRunner();
  const brandRunner = useRunner();
  const [attributeName, setAttributeName] = useState("");
  const [brandName, setBrandName] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        {attributes.map((attribute) => (
          <AttributeCard key={attribute.id} attribute={attribute} />
        ))}
        {attributes.length === 0 ? (
          <p className="text-muted-foreground">Henüz nitelik tanımlanmamış.</p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Yeni nitelik</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                attrRunner.run(
                  () => saveAttributeAction(null, { name: attributeName }),
                  () => setAttributeName(""),
                );
              }}
            >
              <Input
                value={attributeName}
                onChange={(e) => setAttributeName(e.target.value)}
                placeholder="Örn. Kumaş"
                aria-label="Nitelik adı"
                className="max-w-xs"
              />
              <Button
                type="submit"
                disabled={attrRunner.pending || !attributeName.trim()}
              >
                Oluştur
              </Button>
            </form>
            {attrRunner.error ? (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {attrRunner.error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Markalar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-border text-sm">
            {brands.map((brand) => (
              <li
                key={brand.id}
                className="flex items-center justify-between py-2"
              >
                <span>
                  {brand.name}{" "}
                  <span className="text-muted-foreground">
                    ({brand.productCount})
                  </span>
                </span>
                <button
                  type="button"
                  disabled={brandRunner.pending}
                  onClick={() => {
                    if (
                      window.confirm(`"${brand.name}" markası silinsin mi?`)
                    ) {
                      brandRunner.run(() => deleteBrandAction(brand.id));
                    }
                  }}
                  className="text-xs text-red-600 underline"
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              brandRunner.run(
                () => createBrandAction(brandName),
                () => setBrandName(""),
              );
            }}
          >
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Yeni marka"
              aria-label="Yeni marka"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={brandRunner.pending || !brandName.trim()}
            >
              Ekle
            </Button>
          </form>
          {brandRunner.error ? (
            <p role="alert" className="text-sm text-red-600">
              {brandRunner.error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
