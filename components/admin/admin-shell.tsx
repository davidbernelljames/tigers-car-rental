"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  Car,
  Users,
  Wrench,
  Tag,
  BarChart3,
  Settings,
  UserCog,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Roles that may see this item. Omit for "all staff roles". */
  roles?: UserRole[];
}

// Single source of truth for admin navigation. middleware.ts independently
// enforces which of these routes a role may actually reach — this list only
// controls what's offered in the UI, so the two must be kept consistent by
// hand (a role hidden from the nav here but not blocked in middleware would
// be reachable by typing the URL directly).
const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER_ADMIN"] },
  { href: "/admin/staff", label: "My Day", icon: LayoutDashboard, roles: ["STAFF_AGENT"] },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarClock },
  { href: "/admin/fleet", label: "Fleet", icon: Car },
  { href: "/admin/customers", label: "Customers", icon: Users, roles: ["OWNER_ADMIN"] },
  { href: "/admin/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/admin/promotions", label: "Promotions", icon: Tag, roles: ["OWNER_ADMIN"] },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["OWNER_ADMIN"] },
  { href: "/admin/staff-management", label: "Staff", icon: UserCog, roles: ["OWNER_ADMIN"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["OWNER_ADMIN"] },
];

export function AdminShell({
  role,
  staffName,
  children,
}: {
  role: UserRole;
  staffName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const roleLabel: Record<UserRole, string> = {
    OWNER_ADMIN: "Owner",
    STAFF_AGENT: "Admin Assistant",
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between bg-admin px-4 py-3">
        <span className="text-white font-semibold">Tiger&apos;s Admin</span>
        <button onClick={() => setMobileOpen((v) => !v)} className="text-white">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "bg-admin w-64 shrink-0 flex-col md:flex md:min-h-screen",
            mobileOpen ? "flex" : "hidden"
          )}
        >
          <div className="hidden md:block px-5 py-5 border-b border-white/10">
            <p className="text-white font-bold">Tiger&apos;s Admin</p>
            <p className="text-white/50 text-xs mt-0.5">
              {staffName} · {roleLabel[role]}
            </p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 py-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
