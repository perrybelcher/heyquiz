"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { ProfileView } from "@/lib/profile-contract";
import { registerWorkspaceNavigationGuard, workspaceNavigationApproved, subscribeWorkspaceNavigation, workspaceNavigationPending } from "@/lib/workspace-navigation";

const sectionClass = "rounded-2xl border border-[#e4e5de] bg-white p-5 sm:p-7";
type Section = "details" | "email" | "password";
type Feedback = { text: string; error?: boolean };

export default function ProfileSettings({ accountKey }: { accountKey?: string } = {}) {
  const navigationPending = useSyncExternalStore(subscribeWorkspaceNavigation, workspaceNavigationPending, () => false);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [detailsConflict, setDetailsConflict] = useState(false);
  const [busy, setBusy] = useState<Section | null>(null);
  const [feedback, setFeedback] = useState<Partial<Record<Section, Feedback>>>({});
  const busyRef = useRef(false);
  const dirty = !!profile && (name !== profile.name || company !== profile.company || !!email || !!emailPassword || !!currentPassword || !!password || !!confirmPassword);
  const departure = useRef({ dirty, busy });
  useLayoutEffect(() => { departure.current = { dirty, busy }; }, [dirty, busy]);

  useEffect(() => {
    return registerWorkspaceNavigationGuard(async () => {
      if (departure.current.busy) { window.alert("Please wait for your profile update to finish before leaving."); return false; }
      return !departure.current.dirty || window.confirm("You have unsaved profile changes. Leave this page and discard them? Choose Cancel to keep editing.");
    });
  }, []);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (workspaceNavigationApproved()) return;
      if (departure.current.dirty || departure.current.busy) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);

  async function load() {
    busyRef.current = true; setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { if (response.status === 401 || response.status === 403) setNeedsSignIn(true); throw new Error(data.error || "Could not load your profile. Please try again."); }
      setProfile(data); setName(data.name); setCompany(data.company);
      setDetailsConflict(false); setFeedback(value => ({ ...value, details: undefined }));
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not load your profile. Please try again."); }
    finally { busyRef.current = false; setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function reloadLatestDetails() {
    if (busyRef.current) return;
    if (profile && !window.confirm("Reload the latest profile details? Your unsaved name and company edits will be discarded. Email and password entries will stay in this tab.")) return;
    await load();
  }

  async function submit(event: FormEvent, section: Section) {
    event.preventDefault();
    if (!profile || busyRef.current) return;
    if (section === "password" && password !== confirmPassword) {
      setFeedback(value => ({ ...value, password: { text: "The new passwords do not match.", error: true } })); return;
    }
    busyRef.current = true; setBusy(section);
    setFeedback(value => ({ ...value, [section]: undefined }));
    try {
      const endpoint = section === "details" ? "/api/profile" : `/api/profile/${section}`;
      const body = section === "details" ? { name, company, revision: profile.revision }
        : section === "email" ? { email, currentPassword: emailPassword } : { currentPassword, password };
      const response = await fetch(endpoint, { method: section === "details" ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...(accountKey ? { "X-Pippi-Account": accountKey } : {}) }, body: JSON.stringify(body), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setNeedsSignIn(true);
        if (section === "details" && response.status === 409) setDetailsConflict(true);
        throw new Error(data.error || "Your update could not be confirmed. Your entries have been kept. Please try again.");
      }
      if (section === "details") {
        setNeedsSignIn(false);
        setProfile(data); setName(data.name); setCompany(data.company);
        setDetailsConflict(false);
        window.dispatchEvent(new Event("pippi-profile-change"));
        setFeedback(value => ({ ...value, details: { text: "Profile details saved." } }));
      } else if (section === "email") {
        setNeedsSignIn(false);
        setProfile(data); setEmail(""); setEmailPassword("");
        window.dispatchEvent(new Event("pippi-profile-change"));
        setFeedback(value => ({ ...value, email: { text: data.email?.toLowerCase() === email.trim().toLowerCase() && !data.pendingEmail ? "Sign-in email updated." : "Email change requested. Follow the confirmation instructions sent by email. Your current sign-in email stays active until confirmation." } }));
      } else {
        setNeedsSignIn(Boolean(data.reauthRequired));
        setCurrentPassword(""); setPassword(""); setConfirmPassword("");
        setFeedback(value => ({ ...value, password: { text: data.reauthRequired ? "Password updated. Sign in again with your new password to continue." : "Password updated." } }));
      }
    } catch (error) {
      setFeedback(value => ({ ...value, [section]: { text: error instanceof Error ? error.message : "Could not confirm the update. Your entries have been kept.", error: true } }));
    } finally { busyRef.current = false; setBusy(null); }
  }
  const message = (section: Section) => feedback[section] && <p role={feedback[section]?.error ? "alert" : "status"} className={feedback[section]?.error ? "hq-error mt-4" : "mt-4 text-sm text-emerald-800"}>{feedback[section]?.text}</p>;

  return <main inert={navigationPending} className="max-w-3xl mx-auto px-5 py-7 sm:px-10 sm:py-10">
    <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
    <p className="mt-2 mb-7 text-sm text-slate-500">Manage your details and account security.</p>
    {needsSignIn && <p role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Sign into the original account in a new tab, then return here and retry. Your entries stay in this tab. <Link href="/login?next=%2Fprofile" prefetch={false} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Sign in again</Link></p>}
    {loading && <p role="status" className="text-sm text-slate-500">Loading your profile…</p>}
    {loadError && <div className="hq-error" role="alert"><p>{loadError}</p><button type="button" className="hq-secondary mt-3" onClick={() => void reloadLatestDetails()}>Retry loading profile</button></div>}
    {profile && <div className="space-y-5">
      <section className={sectionClass}><h2 className="text-lg font-semibold">Your details</h2><form className="mt-5" onChange={() => setFeedback(value => ({ ...value, details: undefined }))} onSubmit={event => void submit(event, "details")}><fieldset disabled={!!busy || loading} className="space-y-4"><label className="block text-sm font-medium">Name<input className="hq-input mt-2" autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label><label className="block text-sm font-medium">Company<input className="hq-input mt-2" autoComplete="organization" value={company} onChange={event => setCompany(event.target.value)} /></label><button className="hq-primary" disabled={name === profile.name && company === profile.company}>{busy === "details" ? "Saving…" : "Save details"}</button></fieldset>{message("details")}{detailsConflict && <div className="mt-4"><p className="mb-3 text-sm text-slate-500">Your profile changed elsewhere. Reload the latest details before saving again.</p><button type="button" className="hq-secondary" disabled={!!busy || loading} onClick={() => void reloadLatestDetails()}>Reload latest details</button></div>}</form></section>
      <section className={sectionClass}><h2 className="text-lg font-semibold">Email address</h2><p className="mt-2 text-sm text-slate-500">Current sign-in email: <span className="text-slate-800 break-all">{profile.email || "Not available in local mode"}</span></p>{profile.pendingEmail && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Pending confirmation: {profile.pendingEmail}. This is not your confirmed sign-in email yet.</p>}{profile.local && <p className="mt-3 text-sm text-slate-500">Email and password changes are unavailable in local mode.</p>}<form className="mt-5" onChange={() => setFeedback(value => ({ ...value, email: undefined }))} onSubmit={event => void submit(event, "email")}><fieldset disabled={!!busy || loading || profile.local} className="space-y-4"><label className="block text-sm font-medium">New email address<input className="hq-input mt-2" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label className="block text-sm font-medium">Current password to confirm email change<input className="hq-input mt-2" type="password" autoComplete="current-password" required value={emailPassword} onChange={event => setEmailPassword(event.target.value)} /></label><button className="hq-primary">{busy === "email" ? "Requesting change…" : "Request email change"}</button></fieldset>{message("email")}</form></section>
      <section className={sectionClass}><h2 className="text-lg font-semibold">Password</h2><p className="mt-2 text-sm text-slate-500">Confirm your current password before choosing a new one.</p><form className="mt-5" onChange={() => setFeedback(value => ({ ...value, password: undefined }))} onSubmit={event => void submit(event, "password")}><fieldset disabled={!!busy || loading || profile.local} className="space-y-4"><label className="block text-sm font-medium">Current password<input className="hq-input mt-2" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label><label className="block text-sm font-medium">New password<input className="hq-input mt-2" type="password" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><label className="block text-sm font-medium">Confirm new password<input className="hq-input mt-2" type="password" autoComplete="new-password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label><button className="hq-primary">{busy === "password" ? "Updating password…" : "Update password"}</button></fieldset>{message("password")}</form></section>
    </div>}
  </main>;
}
