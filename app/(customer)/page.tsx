import Link from "next/link";
import { ShieldCheck, PlaneTakeoff, Lock, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AvailabilitySearch } from "@/components/booking/availability-search";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { FaqAccordion } from "@/components/home/faq-accordion";
import { HOMEPAGE_FAQS } from "@/lib/faq-content";
import { EmailConfirmedToast } from "@/components/auth/email-confirmed-toast";

export const dynamic = "force-dynamic";

// S1 Homepage. Satisfies FR-09 (Vehicle Catalogue preview) and the SEO
// intent described in SIP Section 2.3 (semantic HTML, Piarco-targeted copy).
export default async function HomePage() {
  const vehicles = await prisma.vehicle.findMany({
    // Excludes RETIRED — a sold vehicle should never surface as a featured
    // "book now" option.
    where: { status: { not: "RETIRED" } },
    take: 3,
    orderBy: { vehicleId: "asc" },
  });

  // [New] Same active-promotion matching used on the full Vehicles & Book
  // catalogue — a promo should be visible wherever a vehicle is shown to a
  // browsing customer, not only on the dedicated catalogue page.
  const today = new Date();
  const activePromos = await prisma.promotion.findMany({
    where: { startDate: { lte: today }, expiryDate: { gte: today } },
    orderBy: { discountPercent: "desc" },
  });
  function bestDiscountFor(vehicleId: number, category: string): number | null {
    const match = activePromos.find(
      (p) => p.vehicleCategory === category && (p.vehicleId === null || p.vehicleId === vehicleId)
    );
    return match ? Number(match.discountPercent) : null;
  }

  // Testimonial section — pulls a real, genuine review rather than the
  // fabricated one previously hardcoded here ("S. Ramsaran, March 2026",
  // a quote that was never actually said by anyone). Only 4-5 star reviews
  // with an actual written comment are shown, since a rating alone has
  // nothing to display as a quote. If none exist yet, the section is
  // hidden entirely below rather than showing anything invented.
  const featuredReview = await prisma.review.findFirst({
    where: { rating: { gte: 4 }, comment: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  return (
    <div>
      <EmailConfirmedToast />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-customer via-customer to-customer-light">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-customer-accent">
              <PlaneTakeoff className="h-3.5 w-3.5" /> Minutes from Piarco
              International Airport
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Reliable Wheels, Piarco to Anywhere in Trinidad
            </h1>
            <p className="mt-4 text-lg text-white/80">
              Browse the fleet, book in minutes, and pay securely online — no
              paperwork, no WhatsApp back-and-forth.
            </p>
          </div>

          <div className="mt-8 max-w-3xl">
            <AvailabilitySearch variant="hero" />
          </div>
        </div>
      </section>

      {/* Trust indicators */}
      <section className="border-b border-neutral-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <TrustItem
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Fully Insured Fleet"
            description="Every vehicle is insured and inspected before pickup."
          />
          <TrustItem
            icon={<PlaneTakeoff className="h-5 w-5" />}
            title="Airport Pickup & Drop-off"
            description="Minutes from Piarco International Airport."
          />
          <TrustItem
            icon={<Lock className="h-5 w-5" />}
            title="Secure Online Payment"
            description="Payments processed via WiPay — no card details stored."
          />
        </div>
      </section>

      {/* Featured vehicles */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">
              Featured Vehicles
            </h2>
            <p className="text-neutral-500 mt-1">
              A snapshot of what&apos;s available today
            </p>
          </div>
          <Link
            href="/vehicles"
            className="text-sm font-medium text-customer hover:underline"
          >
            View all vehicles →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.vehicleId}
              vehicle={{
                vehicleId: v.vehicleId,
                make: v.make,
                model: v.model,
                color: v.color,
                seats: v.seats,
                dailyRate: Number(v.dailyRate),
                category: v.category,
                // Safe assertion, not a loosening: the query above
                // (`status: { not: "RETIRED" }`) already guarantees this at
                // runtime. TypeScript can't prove that from a where-clause
                // value though, so it correctly flags the full VehicleStatus
                // type as unsafe to narrow silently — asserted here instead
                // of widening the customer-facing type to include RETIRED,
                // which every downstream customer component would then need
                // to account for a state that should be structurally
                // impossible in this context.
                status: v.status as
                  "AVAILABLE" | "ON_RENTAL" | "IN_MAINTENANCE",
                photoUrl: v.photoUrl,
                promoDiscountPercent: bestDiscountFor(v.vehicleId, v.category),
              }}
            />
          ))}
        </div>
      </section>

      {/* Testimonial — only rendered once a real, qualifying review exists */}
      {featuredReview && (
        <section className="bg-neutral-50 py-14">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="flex justify-center gap-1 text-customer-accent mb-3">
              {Array.from({ length: featuredReview.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="text-lg text-neutral-700 italic">
              &ldquo;{featuredReview.comment}&rdquo;
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              — {featuredReview.customer.firstName}.{" "}
              {featuredReview.customer.lastName}
            </p>
          </div>
        </section>
      )}

      {/* FAQ teaser — the full set lives on /faq so the homepage stays
          focused on the booking path */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">
            Common Questions
          </h2>
          <Link
            href="/faq"
            className="text-sm font-medium text-customer hover:underline"
          >
            View all FAQs →
          </Link>
        </div>
        <FaqAccordion items={HOMEPAGE_FAQS} />
      </section>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-customer/10 text-customer">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-neutral-900 text-sm">{title}</p>
        <p className="text-sm text-neutral-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
