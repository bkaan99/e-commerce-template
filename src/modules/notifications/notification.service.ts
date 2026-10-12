import { siteConfig } from "@/config/site.config";
import type { JobQueue } from "@/shared/queue";
import type { OrderRepository } from "../orders/order.repository";
import type { EmailMessage } from "@/integrations/notification/mailer";
import {
  renderOrderPlacedManual,
  type BankAccountInfo,
} from "./templates/order-emails";
import {
  renderAdminNewOrder,
  renderOrderCancelled,
  renderOrderConfirmation,
  renderOrderShipped,
  renderStockAvailable,
  type EmailContext,
} from "./templates/order-emails";
import {
  renderDealerApplicationForAdmin,
  renderDealerDecision,
} from "./templates/dealer-emails";
import {
  renderEmailVerification,
  renderPasswordReset,
} from "./templates/account-emails";
import { renderReturnDecision } from "./templates/return-emails";
import type { RenderedEmail } from "./templates/layout";

export const JOB_SEND_EMAIL = "email.send";
const EMAIL_RETRY_LIMIT = 5;

/** Olaylara göre e-postaları üretir ve gönderim için kuyruğa atar. */
export class NotificationService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly queue: JobQueue,
    private readonly context: EmailContext,
    private readonly adminEmail: string = siteConfig.contact.email,
    private readonly bankAccounts: readonly BankAccountInfo[] = siteConfig.b2b
      .bankAccounts,
  ) {}

  async onOrderPaid(orderId: string): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (!order) return;

    await this.enqueue(
      order.email,
      renderOrderConfirmation(order, this.context),
    );
    await this.enqueue(
      this.adminEmail,
      renderAdminNewOrder(order, this.context),
    );
  }

  async onOrderPlaced(
    orderId: string,
    method: "BANK_TRANSFER" | "DEFERRED",
  ): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (!order) return;

    await this.enqueue(
      order.email,
      renderOrderPlacedManual(order, method, this.bankAccounts, this.context),
    );
    await this.enqueue(
      this.adminEmail,
      renderAdminNewOrder(order, this.context),
    );
  }

  async onOrderCancelled(orderId: string, refunded: boolean): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (!order) return;

    await this.enqueue(
      order.email,
      renderOrderCancelled(order, refunded, this.context),
    );
  }

  async onOrderShipped(orderId: string): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (!order) return;

    await this.enqueue(order.email, renderOrderShipped(order, this.context));
  }

  async onReturnDecided(info: {
    email: string;
    orderNumber: string;
    approved: boolean;
    amount: string | null;
    note: string | null;
  }): Promise<void> {
    await this.enqueue(
      info.email,
      renderReturnDecision(
        {
          orderNumber: info.orderNumber,
          approved: info.approved,
          amount: info.amount,
          currency: siteConfig.currency,
          note: info.note,
        },
        this.context,
      ),
    );
  }

  async sendStockAvailable(
    email: string,
    product: { name: string; slug: string },
    unsubscribeUrl: string,
  ): Promise<void> {
    await this.enqueue(
      email,
      renderStockAvailable(product, this.context, unsubscribeUrl),
    );
  }

  async sendEmailVerification(email: string, link: string): Promise<void> {
    await this.enqueue(
      email,
      renderEmailVerification(link, { siteName: this.context.siteName }),
    );
  }

  async sendPasswordReset(email: string, link: string): Promise<void> {
    await this.enqueue(
      email,
      renderPasswordReset(link, { siteName: this.context.siteName }),
    );
  }

  async sendDealerApplicationToAdmin(application: {
    companyName: string;
    taxNumber: string;
    email: string;
  }): Promise<void> {
    await this.enqueue(
      this.adminEmail,
      renderDealerApplicationForAdmin(application, this.context),
    );
  }

  async sendDealerDecision(
    email: string,
    approved: boolean,
    note: string | null,
  ): Promise<void> {
    await this.enqueue(
      email,
      renderDealerDecision(approved, note, this.context),
    );
  }

  private async enqueue(to: string, email: RenderedEmail): Promise<void> {
    const message: EmailMessage = { to, ...email };
    await this.queue.enqueue(JOB_SEND_EMAIL, message, {
      retryLimit: EMAIL_RETRY_LIMIT,
    });
  }
}
