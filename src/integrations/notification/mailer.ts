export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** E-posta gönderim sözleşmesi; SMTP, Resend vb. adapter olarak yazılır. */
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}
