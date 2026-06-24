import { APP_NAMES } from "@surgical/config";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { Container } from "../ui/container";

const footerLinkGroups = [
  {
    links: [
      { href: "/products", label: "All products" },
      { href: "/#categories", label: "Categories" },
      { href: "/brands", label: "Brands" },
      { href: "/#bulk", label: "Bulk quote" }
    ],
    title: "Shop"
  },
  {
    links: [
      { href: "/account/orders", label: "Orders" },
      { href: "/account/quotes", label: "Quotes" },
      { href: "/account/addresses", label: "Saved addresses" },
      { href: "/cart", label: "Cart" }
    ],
    title: "Support"
  }
] as const;

const procurementItems = [
  "GST-ready invoices",
  "Verified catalog",
  "Secure checkout",
  "Bulk order support"
] as const;

export function Footer() {
  return (
    <footer className="min-h-[24rem] border-t border-[#cfe9d2] bg-[#123d18] pb-32 pt-12 text-white md:min-h-[20rem] md:py-16">
      <Container className="max-w-none px-4 sm:px-8 lg:px-12">
        <div
          className="grid gap-9 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.6fr)] lg:items-start"
          data-testid="footer-content"
        >
          <div className="grid gap-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/12">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="text-base font-semibold md:text-lg">
                {APP_NAMES.customerWeb}
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">
              Genuine surgical supplies with clear checkout and GST-ready invoices.
            </p>

            <div className="grid gap-3 text-sm text-white/76 sm:grid-cols-2 lg:grid-cols-1">
              <a
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 transition hover:bg-white/16 sm:w-auto lg:w-full"
                href="tel:+919000000000"
              >
                <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                +91 90000 00000
              </a>
              <a
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 transition hover:bg-white/16 sm:w-auto lg:w-full"
                href="mailto:support@surgical.example"
              >
                <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
                support@surgical.example
              </a>
            </div>
          </div>

          <nav
            aria-label="Footer navigation"
            className="grid gap-7 sm:grid-cols-3"
          >
            {footerLinkGroups.map((group) => (
              <section className="grid content-start gap-3" key={group.title}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
                  {group.title}
                </h2>
                <div className="grid gap-2.5 text-sm font-semibold text-white/72">
                  {group.links.map((link) => (
                    <a
                      className="w-fit transition hover:text-white"
                      href={link.href}
                      key={link.href}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </section>
            ))}

            <section className="grid content-start gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
                Procurement
              </h2>
              <div className="grid gap-2.5 text-sm font-semibold text-white/72">
                {procurementItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>
          </nav>
        </div>

        <div className="mt-10 border-t border-white/15 pt-5 text-xs font-semibold text-white/55">
          <p>Customer catalog, account, quote, and checkout support in one place.</p>
        </div>
      </Container>
    </footer>
  );
}
