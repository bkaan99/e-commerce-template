import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TurnstileWidget } from "@/components/storefront/turnstile-widget";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Kayıt ol",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Kayıt ol</h1>
      <Suspense fallback={null}>
        <RegisterForm captcha={<TurnstileWidget />} />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Zaten hesabınız var mı?{" "}
        <Link href="/giris" className="underline">
          Giriş yapın
        </Link>
      </p>
    </div>
  );
}
