import { Injectable, Logger } from "@nestjs/common";
import type {
  CustomerEmailAddress,
  CustomerEmailEvent,
  CustomerEmailLineItem
} from "@surgical/types";
import { PrismaService } from "../database/prisma.service";
import { ApiQueueService } from "./api-queue.service";

export type CustomerEmailContact = {
  customerId: string | null;
  email: string | null | undefined;
  firstName: string | null | undefined;
};

type MoneyLike = { toFixed(digits: number): string } | number | string;

/**
 * Queues customer emails after a business change has committed. Sending is
 * best-effort: a queue failure is logged and never fails the caller's request.
 * The worker renders, deduplicates by `dedupeKey`, and delivers through Resend.
 */
@Injectable()
export class CustomerEmailNotifier {
  private readonly logger = new Logger(CustomerEmailNotifier.name);

  constructor(
    private readonly queues: ApiQueueService,
    private readonly prisma: PrismaService
  ) {}

  async notifyCustomer(customerId: string, event: CustomerEmailEvent, dedupeKey: string) {
    try {
      const customer = await this.prisma.user.findFirst({
        select: { email: true, firstName: true },
        where: { deletedAt: null, id: customerId }
      });

      if (customer) {
        await this.notify({ customerId, ...customer }, event, dedupeKey);
      }
    } catch (error) {
      this.logFailure(event, dedupeKey, error);
    }
  }

  async notify(contact: CustomerEmailContact, event: CustomerEmailEvent, dedupeKey: string) {
    const email = contact.email?.trim();

    if (!email) {
      return;
    }

    try {
      await this.queues.enqueueCustomerEmail({
        dedupeKey,
        event,
        recipient: {
          customerId: contact.customerId,
          email,
          name: contact.firstName?.trim() ?? ""
        },
        requestedAt: new Date().toISOString(),
        version: 1
      });
    } catch (error) {
      this.logFailure(event, dedupeKey, error);
    }
  }

  private logFailure(event: CustomerEmailEvent, dedupeKey: string, error: unknown) {
    this.logger.warn(
      `Customer email was not queued (template=${event.template}, dedupeKey=${dedupeKey}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function emailMoney(value: MoneyLike) {
  return typeof value === "string" ? Number(value).toFixed(2) : value.toFixed(2);
}

export function emailLineItems(
  items: Array<{ lineTotal: MoneyLike; name: string; quantity: number; unitPrice: MoneyLike }>
): CustomerEmailLineItem[] {
  return items.map((item) => ({
    lineTotal: emailMoney(item.lineTotal),
    name: item.name,
    quantity: item.quantity,
    unitPrice: emailMoney(item.unitPrice)
  }));
}

export function emailAddress(
  address: {
    city: string;
    fullName: string;
    landmark?: string | null;
    line1: string;
    line2: string | null;
    pincode: string;
    state: string;
  } | null
): CustomerEmailAddress | null {
  return address
    ? {
        city: address.city,
        fullName: address.fullName,
        landmark: address.landmark?.trim() || null,
        line1: address.line1,
        line2: address.line2?.trim() || null,
        pincode: address.pincode,
        state: address.state
      }
    : null;
}

/** Customer-visible free text, or null when blank. */
export function emailText(value: string | null | undefined) {
  const text = value?.trim();

  return text ? text : null;
}
