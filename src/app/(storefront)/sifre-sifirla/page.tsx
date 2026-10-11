import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Parola sıfırla",
  robots: { index: false },
};

async function ResetContent({
  searchParams,
}: Pick<PageProps<"/sifre-sifirla">, "searchParams">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  if (!value) {
    return (
      <p className="text-muted-foreground">
        Geçersiz bağlantı.{" "}
        <Link href="/sifremi-unuttum" className="underline">
          Yeni bağlantı isteyin
        </Link>
      </p>
    );
  }

  return <ResetForm token={value} />;
}

export default function ResetPasswordPage({
  searchParams,
}: PageProps<"/sifre-sifirla">) {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Parola sıfırla</h1>
      <Suspense fallback={null}>
        <ResetContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
