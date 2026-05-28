import { APP_NAMES } from "@surgical/config";
import { Globe2, Mail, MapPin, Phone, Share2, ShieldCheck } from "lucide-react";
import { Container } from "../ui/container";

const companyLinks = ["About us", "Hospitals", "Clinics", "Bulk purchase"] as const;
const policyLinks = ["Privacy policy", "Terms", "Shipping", "Returns"] as const;

export function Footer() {
  return (
    <footer className="border-t border-[#d8e2df] bg-[#17211f] py-12 text-white">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#006d77]">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="font-extrabold">{APP_NAMES.customerWeb}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              Customer website for genuine surgical and medical equipment purchasing,
              GST-ready invoicing, and institutional procurement support.
            </p>
          </div>

          <FooterList title="Company" items={companyLinks} />
          <FooterList title="Policies" items={policyLinks} />

          <div>
            <h2 className="text-sm font-extrabold uppercase text-white/80">Contact</h2>
            <div className="mt-4 grid gap-3 text-sm text-white/70">
              <span className="flex gap-2">
                <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                +91 90000 00000
              </span>
              <span className="flex gap-2">
                <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
                support@surgical.example
              </span>
              <span className="flex gap-2">
                <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
                Service coverage across India
              </span>
            </div>
            <div className="mt-5 flex gap-3">
              <a aria-label="LinkedIn" className="grid h-10 w-10 place-items-center rounded-lg bg-white/10" href="#">
                <Share2 aria-hidden="true" className="h-4 w-4" />
              </a>
              <a aria-label="Facebook" className="grid h-10 w-10 place-items-center rounded-lg bg-white/10" href="#">
                <Globe2 aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterList({ items, title }: { items: readonly string[]; title: string }) {
  return (
    <div>
      <h2 className="text-sm font-extrabold uppercase text-white/80">{title}</h2>
      <div className="mt-4 grid gap-3 text-sm text-white/70">
        {items.map((item) => (
          <a className="hover:text-white" href="#" key={item}>
            {item}
          </a>
        ))}
      </div>
    </div>
  );
}
