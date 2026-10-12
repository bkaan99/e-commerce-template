"use server";

import { revalidatePath } from "next/cache";
import { features } from "@/config/features";
import { getCurrentUser } from "@/modules/auth/session";
import { getDealerService } from "@/modules/b2b/container";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface DealerApplyState {
  error?: string;
  submitted?: boolean;
}

export async function applyDealerAction(
  _previous: DealerApplyState,
  formData: FormData,
): Promise<DealerApplyState> {
  if (!features.b2b) return { error: "Bayi başvurusu şu anda kapalı" };

  const user = await getCurrentUser();
  if (!user) return { error: "Başvuru için giriş yapmalısınız" };

  try {
    const ip = await getClientIp();
    await enforceRateLimit("dealer-apply", ip, RATE_LIMIT_POLICIES.register);

    await getDealerService().apply(user.id, {
      companyName: String(formData.get("companyName") ?? ""),
      taxNumber: String(formData.get("taxNumber") ?? ""),
      taxOffice: String(formData.get("taxOffice") ?? ""),
    });
    revalidatePath("/bayi-basvuru");
    revalidatePath("/hesabim");
    return { submitted: true };
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    reportError(error, { action: "dealerApply" });
    return { error: "Başvuru gönderilemedi, lütfen tekrar deneyin." };
  }
}
