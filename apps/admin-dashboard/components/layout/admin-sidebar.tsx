"use client";

import {
  BarChart3,
  Boxes,
  ClipboardList,
  Flag,
  Home,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Percent,
  Settings,
  Tags,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Products", href: "/dashboard/products", icon: Package },
  { title: "Collections", href: "/dashboard/collections", icon: Tags },
  { title: "Inventory", href: "/dashboard/inventory", icon: Boxes },
  { title: "Orders", href: "/dashboard/orders", icon: ClipboardList },
  { title: "Customers", href: "/dashboard/customers", icon: Users },
  { title: "Coupons", href: "/dashboard/coupons", icon: Percent },
  { title: "Banners", href: "/dashboard/banners", icon: Flag },
  { title: "Reviews", href: "/dashboard/reviews", icon: MessageSquareText },
  { title: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AdminSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <aside className={cn(
      "hidden min-h-screen w-64 shrink-0 border-r bg-card lg:block",
      mobileOpen && "fixed inset-y-0 left-0 z-30 block shadow-xl lg:hidden",
    )}>
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Home className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold">Admin</p>
          <p className="text-xs text-muted-foreground">Dashboard</p>
        </div>
        <button type="button" aria-label="Close navigation" onClick={onClose} className="ml-auto rounded-md p-2 hover:bg-accent lg:hidden">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <nav className="space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);

              return (
                <Link
              key={item.href}
              href={item.href}
                  className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-accent text-accent-foreground",
                  )}
                  onClick={onClose}
                >
              <Icon className="size-4" aria-hidden="true" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      {mobileOpen ? <button type="button" aria-label="Close navigation overlay" onClick={onClose} className="fixed inset-0 -z-10 bg-black/30 lg:hidden" /> : null}
    </aside>
  );
}
