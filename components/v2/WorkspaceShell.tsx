"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, FlaskConical, HelpCircle, LayoutGrid, LogOut, Menu, PanelsTopLeft, RotateCcw, UserRound, Users, X } from "lucide-react";
import { navigateWorkspace, signOutWorkspace, subscribeWorkspaceNavigation, workspaceNavigationPending } from "@/lib/workspace-navigation";
import { InterfaceProvider, type InterfaceVersion } from "./InterfaceContext";
import "./workspace.css";

const items = [
  { href: "/", label: "Quizzes", icon: PanelsTopLeft, matches: (path: string) => path === "/" || path.startsWith("/editor") || path.startsWith("/create") || path.startsWith("/scorecard-builder") },
  { href: "/reports", label: "Reports", icon: BarChart3, matches: (path: string) => path.startsWith("/reports") },
  { href: "/contacts", label: "Contacts", icon: Users, matches: (path: string) => path.startsWith("/contacts") },
  { href: "/templates", label: "Templates", icon: LayoutGrid, matches: (path: string) => path.startsWith("/templates") },
  { href: "/experiments", label: "Experiments", icon: FlaskConical, matches: (path: string) => path.startsWith("/experiment") },
];

export default function WorkspaceShell({ version, children }: { version: InterfaceVersion; children: ReactNode }) {
  return <InterfaceProvider version={version}>{version === "v2" ? <V2Shell>{children}</V2Shell> : children}</InterfaceProvider>;
}

function V2Shell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const rail = useRef<HTMLElement>(null);
  const pending = useSyncExternalStore(subscribeWorkspaceNavigation, workspaceNavigationPending, () => false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !rail.current?.contains(event.target) && !menuTrigger.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); menuTrigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  async function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (pending) return;
    setError("");
    try {
      if (await navigateWorkspace(href)) setOpen(false);
      else setError("Finish or save your current changes before leaving this page.");
    } catch { setError("Your current work is still here. Please try opening the page again."); }
  }
  async function signOut() {
    if (pending) return;
    setError("");
    try { if (!(await signOutWorkspace())) setError("Finish or save your current changes before signing out."); }
    catch { setError("Sign-out could not be confirmed. Your current work is still here."); }
  }
  return <div className="pippi-v2" data-interface-version="v2">
    <a className="v2-skip-link" href="#v2-workspace-content">Skip to workspace</a>
    <div className="v2-mobile-bar"><Image src="/pippi-script-logo.png" alt="Pippi" width={80} height={30} /><span>Workspace <span className="v2-beta">Beta</span></span><button ref={menuTrigger} type="button" aria-expanded={open} aria-controls="v2-workspace-navigation" aria-label={open ? "Close workspace menu" : "Open workspace menu"} onClick={() => setOpen(value => !value)}>{open ? <X size={22} /> : <Menu size={22} />}</button></div>
    <aside ref={rail} className={`v2-rail ${open ? "is-open" : ""}`} aria-label="Workspace navigation">
      <Link prefetch={false} className="v2-rail-logo" href="/" aria-label="Pippi quizzes" onClick={event => void follow(event, "/")}><Image src="/pippi-script-logo.png" alt="Pippi" width={76} height={32} /></Link>
      <nav id="v2-workspace-navigation" aria-label="Workspace">
        {items.map(({ href, label, icon: Icon, matches }) => <Link prefetch={false} key={href} href={href} className="v2-rail-link" aria-current={matches(path) ? "page" : undefined} aria-disabled={pending || undefined} onClick={event => void follow(event, href)}><Icon size={21} aria-hidden="true" /><span>{label}</span></Link>)}
      </nav>
      <div className="v2-rail-bottom">
        <Link prefetch={false} href="/interface-recovery" className="v2-rail-link" onClick={event => void follow(event, "/interface-recovery")}><RotateCcw size={18} aria-hidden="true" /><span>Classic</span></Link>
        <Link prefetch={false} href="/help" className="v2-rail-link" aria-current={path.startsWith("/help") ? "page" : undefined} onClick={event => void follow(event, "/help")}><HelpCircle size={21} aria-hidden="true" /><span>Help</span></Link>
        <Link prefetch={false} href="/profile" className="v2-rail-link" aria-current={path === "/profile" ? "page" : undefined} onClick={event => void follow(event, "/profile")}><UserRound size={21} aria-hidden="true" /><span>Profile</span></Link>
        <button type="button" className="v2-rail-link" disabled={pending} onClick={() => void signOut()}><LogOut size={19} aria-hidden="true" /><span>Sign out</span></button>
      </div>
    </aside>
    <div id="v2-workspace-content" className="v2-workspace-content" tabIndex={-1}>
      {error && <div className="v2-navigation-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss navigation message"><X size={16} /></button></div>}
      {children}
    </div>
  </div>;
}
