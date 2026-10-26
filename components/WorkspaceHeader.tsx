"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Menu, Plus, UserRound, X } from "lucide-react";
import { creationAuthHref, safeCreationReturn } from "@/lib/creation-auth-return";
import type { ProfileView } from "@/lib/profile-contract";
import { navigateWorkspace, signOutWorkspace } from "@/lib/workspace-navigation";
import "./WorkspaceHeader.css";
import "./QuizAccountPrompt.css";

type Section = "overview" | "reports" | "contacts" | "templates" | "more" | "profile";
type Profile = ProfileView;
type ProfileState = "loading" | "signed-in" | "signed-out" | "unavailable";
const primary = [{ label: "Overview", href: "/", section: "overview" }, { label: "Reports", href: "/reports", section: "reports" }, { label: "Contacts", href: "/contacts", section: "contacts" }, { label: "Templates", href: "/templates", section: "templates" }] as const;
const secondary = [{ label: "Experiments", href: "/experiments" }, { label: "Help", href: "/help" }] as const;
const subscribePath = () => () => {};
const browserPath = () => window.location.pathname;
const serverPath = () => "";

export function workspaceProfileLabel(profile: Pick<Profile, "name" | "email" | "local"> | null): string {
  return profile?.name.trim() || profile?.email || (profile?.local ? "Local workspace" : "My profile");
}
export function workspaceProfileInitials(profile: Pick<Profile, "name" | "email" | "local"> | null): string {
  const value = profile?.name.trim() || profile?.email.split("@")[0] || "";
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase();
}
export function usesNativeWorkspaceLink(event: Pick<MouseEvent<HTMLAnchorElement>, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented">): boolean {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export default function WorkspaceHeader({ active, guest = false }: { active?: Section; guest?: boolean }) {
  const id = useId(), root = useRef<HTMLElement>(null), moreTrigger = useRef<HTMLButtonElement>(null), profileTrigger = useRef<HTMLButtonElement>(null), mobileTrigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<"more" | "profile" | "mobile" | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null), [profileState, setProfileState] = useState<ProfileState>("loading");
  const pathname = useSyncExternalStore(subscribePath, browserPath, serverPath);
  const section = active || (pathname === "/" ? "overview" : pathname.startsWith("/reports") ? "reports" : pathname.startsWith("/contacts") ? "contacts" : pathname.startsWith("/templates") ? "templates" : pathname.startsWith("/profile") ? "profile" : /^\/(?:experiments|help)(?:\/|$)/.test(pathname) ? "more" : undefined);
  const returnTo = safeCreationReturn(guest ? "/create/draft" : pathname);
  const signInHref = creationAuthHref("/login", returnTo), signupHref = creationAuthHref("/signup", returnTo);
  const signedOut = profileState === "signed-out";

  useEffect(() => {
    let disposed = false, controller: AbortController | null = null;
    const load = async () => {
      controller?.abort(); const request = new AbortController(); controller = request; let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; request.abort(); }, 15000);
      try {
        const response = await fetch("/api/profile", { cache: "no-store", signal: request.signal });
        if (disposed || request.signal.aborted) return;
        if (response.status === 401) { setProfile(null); setProfileState("signed-out"); return; }
        const data = response.ok ? await response.json() : null;
        if (disposed || request.signal.aborted) return;
        if (!response.ok || typeof data?.name !== "string" || typeof data?.company !== "string" || typeof data?.email !== "string" || !Number.isSafeInteger(data?.revision)) throw new Error("Profile unavailable");
        setProfile(data); setProfileState("signed-in");
      } catch { if (!disposed && controller === request && (timedOut || !request.signal.aborted)) setProfileState("unavailable"); }
      finally { clearTimeout(timer); }
    };
    void load();
    window.addEventListener("pippi-profile-change", load); window.addEventListener("pippi-auth-change", load);
    return () => { disposed = true; controller?.abort(); window.removeEventListener("pippi-profile-change", load); window.removeEventListener("pippi-auth-change", load); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const restore = () => { ({ more: moreTrigger, profile: profileTrigger, mobile: mobileTrigger }[open]).current?.focus(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(null); restore(); } };
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(null); };
    const focusOutside = (event: FocusEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(null); };
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", outside); document.addEventListener("focusin", focusOutside);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", focusOutside); };
  }, [open]);

  async function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (usesNativeWorkspaceLink(event) || event.currentTarget.target && event.currentTarget.target !== "_self") return;
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { if (await navigateWorkspace(href)) setOpen(null); else setError("Your current changes need attention before leaving this page."); }
    catch { setError("This page could not be left safely. Your current work is still here."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    if (busy) return;
    setBusy(true); setError("");
    try { if (await signOutWorkspace()) setOpen(null); }
    catch { setError("Sign-out could not be confirmed. Your current work has been kept. Please try again."); }
    finally { setBusy(false); }
  }
  const link = (label: string, href: string, current = false, className = "") => <Link prefetch={false} key={label} href={href} aria-current={current ? "page" : undefined} className={`workspace-header-link ${current ? "is-current" : ""} ${className}`} onClick={event => void follow(event, href)}>{label}</Link>;
  const accountLinks = () => signedOut ? <>{link("Sign in", signInHref)}{link("Create account", signupHref)}</> : <>{link("My profile", "/profile", section === "profile")}<button type="button" className="workspace-header-link" disabled={busy} onClick={() => void signOut()}>Sign out</button></>;

  return <header ref={root} className="workspace-header" data-guest-draft={guest || undefined}>
    <div className="workspace-header-bar">
      <Link prefetch={false} href="/" className="workspace-header-logo" aria-label="Pippi overview" onClick={event => void follow(event, "/")}><Image src="/pippi-logo.svg" alt="Pippi" width="100" height="32" /></Link>
      <nav aria-label="Workspace" className="workspace-header-desktop workspace-header-navigation">
        {primary.map(item => link(item.label, item.href, section === item.section))}
        <div className="workspace-header-disclosure">
          <button ref={moreTrigger} type="button" className={`workspace-header-link ${section === "more" ? "is-current" : ""}`} aria-expanded={open === "more"} aria-controls={`${id}-more`} onClick={() => setOpen(value => value === "more" ? null : "more")}>More<ChevronDown size={14} aria-hidden="true" /></button>
          {open === "more" && <div id={`${id}-more`} className="workspace-header-popover" aria-label="More workspace pages">{secondary.map(item => link(item.label, item.href, pathname === item.href || pathname.startsWith(item.href + "/")))}</div>}
        </div>
      </nav>
      <div className="workspace-header-actions">
        <Link prefetch={false} href="/create" className="workspace-header-create" onClick={event => void follow(event, "/create")}><Plus size={16} aria-hidden="true" />Create quiz</Link>
        <div className="workspace-header-desktop workspace-header-disclosure">
          <button ref={profileTrigger} type="button" className={`workspace-header-profile ${section === "profile" ? "is-current" : ""}`} aria-label="Profile" aria-expanded={open === "profile"} aria-controls={`${id}-profile`} onClick={() => setOpen(value => value === "profile" ? null : "profile")}>
            <span className="workspace-header-avatar" aria-hidden="true">{workspaceProfileInitials(profile) || <UserRound size={16} />}</span>
            <span className="workspace-header-profile-name">{signedOut ? "Account" : workspaceProfileLabel(profile)}</span><ChevronDown size={14} aria-hidden="true" />
          </button>
          {open === "profile" && <div id={`${id}-profile`} className="workspace-header-popover workspace-header-account" aria-label="Account options">
            {profile && <div className="workspace-header-identity"><strong>{workspaceProfileLabel(profile)}</strong>{profile.email && <span>{profile.email}</span>}</div>}
            {profileState === "unavailable" && <p className="workspace-header-notice" role="status">Profile details are temporarily unavailable.</p>}
            {accountLinks()}
          </div>}
        </div>
        <button ref={mobileTrigger} type="button" className="workspace-header-mobile-toggle" aria-label="Workspace menu" aria-expanded={open === "mobile"} aria-controls={`${id}-mobile`} onClick={() => setOpen(value => value === "mobile" ? null : "mobile")}>{open === "mobile" ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}</button>
      </div>
    </div>
    {open === "mobile" && <nav id={`${id}-mobile`} className="workspace-header-mobile-menu" aria-label="Workspace menu">
      {primary.map(item => link(item.label, item.href, section === item.section))}
      {secondary.map(item => link(item.label, item.href, pathname === item.href || pathname.startsWith(item.href + "/")))}
      <div className="workspace-header-mobile-account">{profile && <p className="workspace-header-notice">{workspaceProfileLabel(profile)}</p>}{profileState === "unavailable" && <p role="status" className="workspace-header-notice">Profile details are temporarily unavailable.</p>}{accountLinks()}</div>
    </nav>}
    {error && <p role="alert" className="workspace-header-error">{error}</p>}
  </header>;
}
