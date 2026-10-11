import nodemailer, { type Transporter } from "nodemailer";
import type { EmailMessage, Mailer } from "./mailer";

export interface SmtpConfig {
  host: string;
  port: number;
  from: string;
  user?: string;
  password?: string;
}

export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth:
        config.user && config.password
          ? { user: config.user, pass: config.password }
          : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
