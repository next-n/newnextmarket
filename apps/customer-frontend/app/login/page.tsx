"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthTokens } from "@/lib/auth-storage";
import { customerRequest } from "@/lib/customer-api";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const result = await customerRequest<any>("/auth/login", { method: "POST", body: JSON.stringify(form) }); setAuthTokens(result.accessToken, result.refreshToken); router.push("/account"); router.refresh(); } catch (reason: any) { setError(reason.message); } finally { setSaving(false); } }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><span className="eyebrow">Customer account</span><h1>Welcome back</h1><p className="muted">Sign in to view your account and orders.</p><input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button className="button auth-submit" disabled={saving}>{saving ? "Signing in..." : "Sign in"}</button>{error ? <p className="form-error">{error}</p> : null}<p className="auth-footer">New here? <Link href="/register">Create an account</Link></p><Link href="/" className="muted">Continue shopping</Link></form></main>;
}
