import { APP_NAMES } from "@surgical/config";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { Container } from "../ui/container";

export function Footer() {
  return (
    <footer className="border-t border-[#d6e7f8] bg-[#0b376f] py-10 text-white">
      <Container>
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/12">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="font-bold">{APP_NAMES.customerWeb}</span>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/72">
              Genuine surgical supplies with clear checkout and GST-ready invoices.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-sm text-white/76 sm:flex-row sm:flex-wrap md:justify-end">
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 transition hover:bg-white/16"
              href="tel:+919000000000"
            >
              <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
              +91 90000 00000
            </a>
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 transition hover:bg-white/16"
              href="mailto:support@surgical.example"
            >
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
              support@surgical.example
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
