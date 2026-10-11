import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAccountService } from "@/modules/account/container";
import { isAppError } from "@/shared/errors";

export const metadata: Metadata = {
  title: "E-posta doğrulama",
  robots: { index: false },
};

async function VerifyContent({
  searchParams,
}: Pick<PageProps<"/dogrula">, "searchParams">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  try {
    if (!value) throw new Error("missing");
    await getAccountService().verifyEmail(value);
  } catch (error) {
    const message = isAppError(error)
      ? error.message
      : "Doğrulama bağlantısı geçersiz.";
    return (
      <p role="alert" className="text-red-600">
        {message}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-green-700">E-posta adresiniz doğrulandı.</p>
      <Link href="/giris" className="underline">
        Giriş yap
      </Link>
    </div>
  );
}

export default function VerifyEmailPage({
  searchParams,
}: PageProps<"/dogrula">) {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">E-posta doğrulama</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">Doğrulanıyor...</p>}
      >
        <VerifyContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
