import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TurnstileWidget } from "@/components/storefront/turnstile-widget";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş yap",
  robots: { index: false },
};

async function LoginContent({
  searchParams,
}: Pick<PageProps<"/giris">, "searchParams">) {
  const params = await searchParams;
  const callbackUrl =
    typeof params["callbackUrl"] === "string"
      ? params["callbackUrl"]
      : "/hesabim";

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {params["kayit"] ? (
        <p
          role="status"
          className="rounded-theme bg-green-50 p-3 text-sm text-green-800"
        >
          Kaydınız oluşturuldu. E-postanıza gelen bağlantıyla adresinizi
          doğrulayabilirsiniz.
        </p>
      ) : null}
      {params["sifre"] ? (
        <p
          role="status"
          className="rounded-theme bg-green-50 p-3 text-sm text-green-800"
        >
          Parolanız güncellendi. Yeni parolanızla giriş yapabilirsiniz.
        </p>
      ) : null}
      <LoginForm callbackUrl={callbackUrl} captcha={<TurnstileWidget />} />
    </div>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/giris">) {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Giriş yap</h1>
      <Suspense fallback={null}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
      <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
        <Link href="/sifremi-unuttum" className="underline">
          Parolamı unuttum
        </Link>
        <span>
          Hesabınız yok mu?{" "}
          <Link href="/kayit" className="underline">
            Kayıt olun
          </Link>
        </span>
      </div>
    </div>
  );
}
