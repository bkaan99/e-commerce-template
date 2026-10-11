import type { Metadata } from "next";
import { LookupForm } from "./lookup-form";

export const metadata: Metadata = {
  title: "Sipariş sorgula",
  robots: { index: false },
};

export default function OrderLookupPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Sipariş sorgula</h1>
      <p className="text-muted-foreground">
        Üye olmadan verdiğiniz siparişi, sipariş numarası ve e-posta adresinizle
        takip edebilirsiniz.
      </p>
      <LookupForm />
    </div>
  );
}
