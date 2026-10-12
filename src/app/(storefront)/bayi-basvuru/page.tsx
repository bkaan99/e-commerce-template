import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { features } from "@/config/features";
import { getCurrentUser } from "@/modules/auth/session";
import { getDealerService } from "@/modules/b2b/container";
import { DealerApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Bayi başvurusu",
  robots: { index: false },
};

async function DealerContent() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-muted-foreground">
          Bayi başvurusu için önce giriş yapmalı veya kayıt olmalısınız.
        </p>
        <div className="flex gap-4">
          <Link href="/giris?callbackUrl=/bayi-basvuru" className="underline">
            Giriş yap
          </Link>
          <Link href="/kayit" className="underline">
            Kayıt ol
          </Link>
        </div>
      </div>
    );
  }

  const profile = await getDealerService().getProfile(user.id);

  if (profile?.status === "APPROVED") {
    return (
      <p
        role="status"
        className="rounded-theme bg-green-50 p-4 text-sm text-green-800"
      >
        Onaylı bayisiniz{profile.groupName ? ` (${profile.groupName})` : ""}.
        Bayi fiyatlarınız giriş yaptığınızda otomatik uygulanır.
      </p>
    );
  }

  if (profile?.status === "PENDING") {
    return (
      <p
        role="status"
        className="rounded-theme bg-amber-50 p-4 text-sm text-amber-800"
      >
        Başvurunuz inceleniyor ({profile.companyName}). Sonucu e-posta ile
        bildireceğiz.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {profile?.status === "REJECTED" ? (
        <p
          role="alert"
          className="max-w-md rounded-theme bg-red-50 p-4 text-sm text-red-800"
        >
          Önceki başvurunuz onaylanmadı
          {profile.note ? `: ${profile.note}` : "."} Bilgilerinizi güncelleyerek
          yeniden başvurabilirsiniz.
        </p>
      ) : null}
      <DealerApplyForm />
    </div>
  );
}

export default function DealerApplicationPage() {
  if (!features.b2b) notFound();

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Bayi başvurusu</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Toptan fiyatlar ve vadeli ödeme seçenekleri için firma bilgilerinizi
        gönderin. Başvurunuz onaylandığında bayi fiyatlarını görebilirsiniz.
      </p>
      <Suspense fallback={null}>
        <DealerContent />
      </Suspense>
    </div>
  );
}
