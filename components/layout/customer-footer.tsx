import Link from "next/link";
import { ShieldCheck, Mail, Phone } from "lucide-react";

export function CustomerFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
          <ShieldCheck className="h-4 w-4 text-status-available" />
          Secure booking — SSL encrypted · Payments processed via WiPay
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-neutral-900 mb-2">Tiger&apos;s Car Rental</p>
            <p className="text-sm text-neutral-500">
              Reliable wheels, Piarco to anywhere in Trinidad.
            </p>
          </div>

          <div className="text-sm text-neutral-600 space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-neutral-400" /> +1 868-278-7352
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-neutral-400" /> +1 868-474-1905
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-neutral-400" /> kadesh306@gmail.com
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <Link href="/faq" className="text-neutral-600 hover:text-customer">
              FAQs
            </Link>
            <Link href="/terms" className="text-neutral-600 hover:text-customer">
              Terms
            </Link>
            <Link href="/privacy" className="text-neutral-600 hover:text-customer">
              Privacy
            </Link>
          </div>
        </div>

        <p className="mt-8 text-xs text-neutral-400">
          © 2026 Tiger&apos;s Car Rental, Piarco, Trinidad and Tobago.
        </p>
      </div>
    </footer>
  );
}
