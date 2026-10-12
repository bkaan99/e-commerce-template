import { escapeHtml, wrapInLayout, type RenderedEmail } from "./layout";

interface Context {
  siteName: string;
  baseUrl: string;
}

export function renderDealerApplicationForAdmin(
  application: { companyName: string; taxNumber: string; email: string },
  context: Context,
): RenderedEmail {
  const link = `${context.baseUrl}/admin/bayiler`;

  return {
    subject: `Yeni bayi başvurusu: ${application.companyName}`,
    html: wrapInLayout({
      siteName: context.siteName,
      title: "Yeni bayi başvurusu",
      bodyHtml: `<p><strong>${escapeHtml(application.companyName)}</strong> (VKN ${escapeHtml(application.taxNumber)})</p>
        <p>${escapeHtml(application.email)}</p>
        <p><a href="${escapeHtml(link)}">Başvuruyu incele</a></p>`,
    }),
    text: `Yeni bayi başvurusu: ${application.companyName} (VKN ${application.taxNumber}) <${application.email}>\n${link}`,
  };
}

export function renderDealerDecision(
  approved: boolean,
  note: string | null,
  context: Context,
): RenderedEmail {
  if (approved) {
    const link = `${context.baseUrl}/giris`;
    return {
      subject: "Bayi başvurunuz onaylandı",
      html: wrapInLayout({
        siteName: context.siteName,
        title: "Bayi başvurunuz onaylandı",
        bodyHtml: `<p>Başvurunuz onaylandı. Giriş yaptığınızda bayi fiyatlarınızı ve ödeme seçeneklerinizi görebilirsiniz.</p>
          <p><a href="${escapeHtml(link)}">Giriş yap</a></p>`,
      }),
      text: `Bayi başvurunuz onaylandı. Giriş yaparak bayi fiyatlarınızı görebilirsiniz: ${link}`,
    };
  }

  const reason = note
    ? `Gerekçe: ${note}`
    : "Başvurunuz şu an için uygun bulunmadı.";
  return {
    subject: "Bayi başvurunuz hakkında",
    html: wrapInLayout({
      siteName: context.siteName,
      title: "Bayi başvurunuz hakkında",
      bodyHtml: `<p>Başvurunuz değerlendirildi ancak onaylanamadı.</p><p>${escapeHtml(reason)}</p>`,
    }),
    text: `Bayi başvurunuz onaylanamadı. ${reason}`,
  };
}
