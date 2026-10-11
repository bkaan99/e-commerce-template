import type { EmailMessage } from "@/integrations/notification/mailer";
import { SmtpMailer } from "@/integrations/notification/smtp-mailer";
import { JOB_SEND_EMAIL } from "@/modules/notifications/notification.service";
import { getEnv } from "@/shared/env";
import { logger } from "@/shared/logger";
import type { JobQueue } from "@/shared/queue";

/** E-posta gönderim işlerini SMTP üzerinden işler; hata verirse kuyruk yeniden dener. */
export async function registerEmailJobs(queue: JobQueue): Promise<void> {
  const env = getEnv();
  const mailer = new SmtpMailer({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    from: env.MAIL_FROM,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
  });

  await queue.process<EmailMessage>(JOB_SEND_EMAIL, async (message) => {
    await mailer.send(message);
    logger.info(
      { to: message.to, subject: message.subject },
      "E-posta gönderildi",
    );
  });
}
