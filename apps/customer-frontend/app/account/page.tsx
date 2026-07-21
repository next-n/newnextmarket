"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { customerRequest } from "@/lib/customer-api";
import { SiteHeader } from "@/components/site-header";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { customerRequest<any>("/auth/me").then((profile) => { setUser(profile); setForm({ firstName: profile.firstName ?? "", lastName: profile.lastName ?? "", phone: profile.phone ?? "" }); }).catch(() => router.replace("/login")).finally(() => setLoading(false)); }, [router]);

  function startEditing() { setForm({ firstName: user.firstName ?? "", lastName: user.lastName ?? "", phone: user.phone ?? "" }); setMessage(""); setEditing(true); }
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); try { const profile = await customerRequest<any>("/auth/me", { method: "PATCH", body: JSON.stringify({ ...form, phone: form.phone || null }) }); setUser(profile); setEditing(false); setMessage("Profile updated"); } catch (error: any) { setMessage(error.message); } finally { setSaving(false); } }

  if (loading) return <><SiteHeader /><main className="container section"><p className="muted">Loading account...</p></main></>;
  if (!user) return null;
  return <><SiteHeader /><main className="container section"><span className="eyebrow">My account</span><h1>Welcome, {user.firstName}</h1><p className="muted">Manage your customer account.</p><div className="account-grid"><section className="account-card"><div className="account-card-heading"><h2>Profile</h2>{!editing ? <button type="button" onClick={startEditing} className="text-button">Edit profile</button> : null}</div>{editing ? <form className="profile-form" onSubmit={save}><input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /><input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /><input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><p className="profile-email"><strong>Email</strong><br />{user.email}</p><div className="profile-actions"><button className="button" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button><button type="button" onClick={() => setEditing(false)} className="text-button" disabled={saving}>Cancel</button></div></form> : <><p><strong>Name</strong><br />{user.firstName} {user.lastName}</p><p><strong>Email</strong><br />{user.email}</p><p><strong>Phone</strong><br />{user.phone ?? "Not added"}</p></>}{message ? <p className="form-message">{message}</p> : null}</section><section className="account-card"><h2>Shopping</h2><Link href="/products" className="button">Continue shopping</Link><Link href="/account/orders" className="account-link">Track my orders</Link></section></div></main></>;
}
