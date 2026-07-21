"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthTokens } from "@/lib/auth-storage";
import { customerRequest } from "@/lib/customer-api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const result = await customerRequest<any>("/auth/register", { method: "POST", body: JSON.stringify(form) }); setAuthTokens(result.accessToken, result.refreshToken); router.push("/account"); router.refresh(); } catch (reason: any) { setError(reason.message); } finally { setSaving(false); } }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><span className="eyebrow">Customer account</span><h1>Create account</h1><p className="muted">Save your details for a faster checkout.</p><div className="auth-row"><input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /><input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div><input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required minLength={8} type="password" placeholder="Password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button className="button auth-submit" disabled={saving}>{saving ? "Creating..." : "Create account"}</button>{error ? <p className="form-error">{error}</p> : null}<p className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></p><Link href="/" className="muted">Continue shopping</Link></form></main>;
}
