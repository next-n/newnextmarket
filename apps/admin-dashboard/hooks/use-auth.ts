"use client";

import { useMemo } from "react";

import { clearAdminSession, hasAdminSession } from "@/lib/auth/auth-utils";

export function useAuth() {
  return useMemo(
    () => ({
      isAuthenticated: hasAdminSession(),
      logout: clearAdminSession,
    }),
    [],
  );
}
