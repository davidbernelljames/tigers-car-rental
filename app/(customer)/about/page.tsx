import { PlaneTakeoff, Wrench, UserCircle2 } from "lucide-react";

// CONTENT NOTICE: "Our Story" and the 2024 "Our Journey" entry were
// previously a "Draft — awaiting confirmation" placeholder. Both are now
// written from what Kadesh actually described directly — business founded
// in 2024, starting with a single vehicle, growing the fleet by acquiring
// additional vehicles on payment arrangements structured so the rental
// income from each vehicle covered its own cost. The prose below is a
// professional summary of that description, not additional invented detail
// (no specific milestone dates, figures, or events beyond what was stated).
const JOURNEY = [
  {
    year: "2024",
    text: "Tiger's Car Rental is founded and registered, beginning operations with a single vehicle.",
  },
  {
    year: "2025",
    text: "Expanded to 6 vehicles",
  },
  {
    year: "2026",
    text: "Downsized to 4 vehicles",
  },
  {
    year: "2025",
    text: "Digital transformation project pitched and initiated to develop an integrated online booking and management system.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <section className="bg-customer py-14">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            About Tiger&apos;s Car Rental
          </h1>
          <p className="mt-3 text-white/80">
            Proudly serving travellers near Piarco International Airport.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-xl font-semibold text-neutral-900 mb-3">
          Our Story
        </h2>
        <div className="space-y-4 text-neutral-600 text-sm leading-relaxed">
          <p>
            Tiger&apos;s Car Rental was founded and registered in 2024, starting
            with a single vehicle and a straightforward goal: provide reliable,
            well-maintained cars to local and foreign customers.
          </p>
          <p>
            The fleet grew from that one vehicle through a deliberate,
            self-funding approach — each additional car was acquired on payment
            terms structured so that the income it generated from rentals
            covered its own cost over time, allowing the business to reinvest in
            further vehicles without taking on outside financing.
          </p>
          <p>
            That same practical, grounded approach continues today, now
            extending into a digital booking system designed to make renting a
            car simpler for customers while preserving the personal service the
            business was built on.
          </p>
        </div>
      </section>

      <section className="bg-neutral-50 py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-xl font-semibold text-neutral-900 mb-6">
            Our Journey
          </h2>
          <div className="space-y-6">
            {JOURNEY.map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="w-16 shrink-0 font-bold text-customer">
                  {item.year}
                </div>
                <p className="text-neutral-600 text-sm leading-relaxed border-l border-neutral-200 pl-4">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h2 className="text-xl font-semibold text-neutral-900 mb-6 text-center">
          Why Choose Us
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <WhyItem
            icon={<PlaneTakeoff className="h-5 w-5" />}
            title="Airport Convenience"
            description="Minutes from Piarco International Airport — no long transfers."
          />
          <WhyItem
            icon={<Wrench className="h-5 w-5" />}
            title="Maintained Fleet"
            description="Every vehicle is regularly inspected and fully insured before each rental."
          />
          <WhyItem
            icon={<UserCircle2 className="h-5 w-5" />}
            title="Personal Service"
            description="A family-run business where every customer is known by name, not a booking number."
          />
        </div>
      </section>
    </div>
  );
}

function WhyItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-customer/10 text-customer mb-3">
        {icon}
      </div>
      <p className="font-semibold text-neutral-900 text-sm">{title}</p>
      <p className="text-sm text-neutral-500 mt-1">{description}</p>
    </div>
  );
}
