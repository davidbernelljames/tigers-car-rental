"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { anton } from "@/lib/fonts";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/vehicles", label: "Vehicles & Book" },
  { href: "/booking/find", label: "Find My Booking" },
  { href: "/account", label: "My Account" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function CustomerHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-customer">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-white">
          <Image
            src="/tiger-logo.png"
            alt="Tiger's Car Rental"
            width={56}
            height={60}
            className="h-14 w-auto object-contain"
            priority
          />
          <span className={cn(anton.className, "leading-none uppercase tracking-wide")}>
            <span className="block text-lg text-white">Tiger&apos;s</span>
            <span className="block text-lg text-customer-accent -mt-1">
              Car Rental
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-white" : "text-white/70 hover:text-white"
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-customer-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Link href="/vehicles">
            <Button size="sm">Book</Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-white/10 bg-customer px-4 pb-4 pt-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/vehicles" onClick={() => setMobileOpen(false)}>
            <Button className="mt-2 w-full">Book</Button>
          </Link>
        </nav>
      )}
    </header>
  );
}
