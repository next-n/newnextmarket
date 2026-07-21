"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { hasAdminSession } from "@/lib/auth/auth-utils";

import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!hasAdminSession()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AdminSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="min-w-0 flex-1">
          <AdminHeader onMenu={() => setMobileMenuOpen(true)} />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
