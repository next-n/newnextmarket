"use client";

import { Bell, Menu, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { clearAdminSession } from "@/lib/auth/auth-utils";

export function AdminHeader({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();

  function logout() {
    clearAdminSession();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Open navigation" className="lg:hidden" onClick={onMenu}>
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="sm" onClick={logout}>
          <UserRound className="size-4" aria-hidden="true" />
          Logout
        </Button>
      </div>
    </header>
  );
}
