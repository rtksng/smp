import type { CustomerEmailEvent } from "@surgical/types";
import type {
  CustomerEmailContact,
  CustomerEmailNotifier
} from "../../src/queues/customer-email.notifier";

export type RecordedCustomerEmail = {
  customerId: string | null;
  dedupeKey: string;
  email?: string | null;
  event: CustomerEmailEvent;
};

/** Stands in for CustomerEmailNotifier and records what services ask to send. */
export function createRecordingNotifier() {
  const sent: RecordedCustomerEmail[] = [];
  const notifier = {
    notify: async (contact: CustomerEmailContact, event: CustomerEmailEvent, dedupeKey: string) => {
      sent.push({ customerId: contact.customerId, dedupeKey, email: contact.email, event });
    },
    notifyCustomer: async (customerId: string, event: CustomerEmailEvent, dedupeKey: string) => {
      sent.push({ customerId, dedupeKey, event });
    }
  };

  return { notifier: notifier as unknown as CustomerEmailNotifier, sent };
}
