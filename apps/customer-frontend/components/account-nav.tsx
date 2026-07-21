"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customerRequest, signOut } from "@/lib/customer-api";

export function AccountNav() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { customerRequest<any>("/auth/me").then(setUser).catch(() => setUser(null)); }, []);
  if (!user) return <Link href="/login">Login</Link>;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "A";
  return <span className="account-nav"><button type="button" className="profile-chip profile-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}><span className="profile-avatar">{initials}</span><span>{user.firstName ?? "Account"}</span><span className="profile-chevron">⌄</span></button>{open ? <span className="profile-dropdown"><Link href="/account" onClick={() => setOpen(false)}>View account</Link><Link href="/account/orders" onClick={() => setOpen(false)}>Track orders</Link><button type="button" onClick={() => { signOut(); setUser(null); window.location.href = "/"; }}>Log out</button></span> : null}</span>;
}
