import { escapeHtml, wrapInLayout, type RenderedEmail } from "./layout";

interface Context {
  siteName: string;
}

export function renderEmailVerification(
  link: string,
  context: Context,
): RenderedEmail {
  return {
    subject: "E-posta adresinizi doğrulayın",
    html: wrapInLayout({
      siteName: context.siteName,
      title: "E-posta adresinizi doğrulayın",
      bodyHtml: `<p>Hesabınızı etkinleştirmek için aşağıdaki bağlantıya tıklayın. Bağlantı 3 gün geçerlidir.</p>
        <p><a href="${escapeHtml(link)}">E-postamı doğrula</a></p>`,
    }),
    text: `E-posta adresinizi doğrulamak için bağlantıyı açın (3 gün geçerli):\n${link}`,
  };
}

export function renderPasswordReset(
  link: string,
  context: Context,
): RenderedEmail {
  return {
    subject: "Parola sıfırlama talebi",
    html: wrapInLayout({
      siteName: context.siteName,
      title: "Parolanızı sıfırlayın",
      bodyHtml: `<p>Parolanızı sıfırlamak için aşağıdaki bağlantıya tıklayın. Bağlantı 1 saat geçerlidir.</p>
        <p><a href="${escapeHtml(link)}">Parolamı sıfırla</a></p>
        <p style="color:#71717a;font-size:13px;">Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`,
    }),
    text: `Parolanızı sıfırlamak için bağlantıyı açın (1 saat geçerli):\n${link}\n\nBu talebi siz yapmadıysanız yok sayabilirsiniz.`,
  };
}
