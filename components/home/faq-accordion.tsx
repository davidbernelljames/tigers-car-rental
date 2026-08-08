"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FaqItem } from "@/lib/faq-content";

/**
 * Reusable accordion. Content comes from lib/faq-content.ts so the homepage
 * teaser and the full /faq page can never drift out of sync.
 */
export function FaqAccordion({
  items,
  defaultOpen = null,
}: {
  items: FaqItem[];
  defaultOpen?: number | null;
}) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(defaultOpen);

  return (
    <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={open}
            >
              <span className="font-medium text-neutral-900">{item.q}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-neutral-400 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            {open && (
              <div className="px-5 pb-4 text-sm leading-relaxed text-neutral-600">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
