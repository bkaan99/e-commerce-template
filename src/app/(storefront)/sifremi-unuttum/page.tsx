import type { Metadata } from "next";
import { Suspense } from "react";
import { TurnstileWidget } from "@/components/storefront/turnstile-widget";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Parolamı unuttum",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Parolamı unuttum</h1>
      <Suspense fallback={null}>
        <ForgotForm captcha={<TurnstileWidget />} />
      </Suspense>
    </div>
  );
}
