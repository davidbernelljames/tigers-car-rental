import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/home/faq-accordion";
import { FAQS, FAQ_CATEGORIES } from "@/lib/faq-content";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Tiger's Car Rental",
  description:
    "Driver requirements, fuel and late-return policy, cancellations, and what to do in a breakdown — everything you need to know before renting from Tiger's Car Rental in Piarco, Trinidad.",
};

// Dedicated FAQ page. Split out from the homepage accordion once the content
// grew past the handful of items an inline accordion handles well: a page of
// this size pushed the homepage's booking path too far down, and policy
// content of this kind benefits from being independently linkable and
// indexable.
export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-neutral-900">
        Frequently Asked Questions
      </h1>
      <p className="text-neutral-500 mt-2 mb-10">
        Everything you need to know before collecting your vehicle.
      </p>

      <div className="space-y-10">
        {FAQ_CATEGORIES.map((category) => {
          const items = FAQS.filter((f) => f.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                {category}
              </h2>
              <FaqAccordion items={items} defaultOpen={null} />
            </section>
          );
        })}
      </div>

      {/* Single point of contact for anything not answered above. Contact
          details themselves live on /contact only, so there is one place to
          keep them current rather than several. */}
      <div className="mt-12 rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center">
        <p className="font-medium text-neutral-900">Still have a question?</p>
        <p className="text-sm text-neutral-500 mt-1 mb-4">
          We&apos;re available 24 hours — get in touch and we&apos;ll help.
        </p>
        <Link href="/contact">
          <Button variant="outline">Contact Us</Button>
        </Link>
      </div>
    </div>
  );
}
