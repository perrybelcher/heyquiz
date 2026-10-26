import { requestSafeLogout } from "./session-client";

type NavigationGuard = () => Promise<boolean>;
const guards = new Set<NavigationGuard>();
let preparing: Promise<boolean> | null = null;
let navigating: Promise<boolean> | null = null;
let approvedUntil = 0;
let guardRevision = 0;
let preparedRevision = -1;
let navigationPending = false;
const navigationListeners = new Set<() => void>();

export function subscribeWorkspaceNavigation(listener: () => void): () => void {
  navigationListeners.add(listener);
  return () => { navigationListeners.delete(listener); };
}

export function workspaceNavigationPending(): boolean {
  return navigationPending;
}

function setNavigationPending(value: boolean): void {
  navigationPending = value;
  for (const listener of [...navigationListeners]) {
    try { listener(); } catch { /* A subscriber cannot interrupt navigation cleanup. */ }
  }
}

export function registerWorkspaceNavigationGuard(handler: NavigationGuard): () => void {
  if (!guards.has(handler)) { guards.add(handler); guardRevision++; approvedUntil = 0; }
  return () => { if (guards.delete(handler)) { guardRevision++; approvedUntil = 0; } };
}

/** Guards own saving/review UI. Failure or cancellation always keeps this page. */
export function prepareWorkspaceNavigation(): Promise<boolean> {
  if (preparing) return preparing;
  preparing = (async () => {
    try {
      preparedRevision = -1;
      // React may replace a guard while its save/review promise is pending.
      // Only a stable pass over the current registrations can approve leaving.
      for (let pass = 0; pass < 4; pass++) {
        const revision = guardRevision;
        for (const guard of [...guards]) {
          const allowed = await guard();
          if (guardRevision !== revision) break;
          if (!allowed) return false;
        }
        if (guardRevision === revision) { preparedRevision = revision; return true; }
      }
      return false;
    } catch { return false; }
  })().finally(() => { preparing = null; });
  return preparing;
}

/** Native departures still warn. Only an immediately approved app navigation
 * suppresses a duplicate beforeunload prompt, and the approval expires quickly. */
export function workspaceNavigationApproved(): boolean {
  return approvedUntil > Date.now();
}

export function workspaceDestination(href: string): string | null {
  if (typeof window === "undefined" || typeof href !== "string" || !href || /[\\\u0000-\u0020\u007f]/.test(href)) return null;
  try {
    const url = new URL(href, window.location.href);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== window.location.origin || url.username || url.password) return null;
    // API and framework internals are not workspace document destinations.
    const pathname = decodeURIComponent(url.pathname);
    if (/^\/(?:api|_next)(?:\/|$)/.test(pathname)) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

function assignApproved(href: string): boolean {
  approvedUntil = Date.now() + 1000;
  const expiry = approvedUntil;
  setTimeout(() => { if (approvedUntil === expiry) approvedUntil = 0; }, 1000);
  try { window.location.assign(href); return true; }
  catch { approvedUntil = 0; return false; }
}

function navigationAction(action: () => Promise<boolean>): Promise<boolean> {
  if (navigationPending || navigating) return Promise.resolve(false);
  approvedUntil = 0;
  // Notify editing surfaces before guards, saves, or logout can begin. The
  // pending flag also rejects reentrant navigation from a subscriber.
  setNavigationPending(true);
  navigating = Promise.resolve().then(action).finally(() => {
    navigating = null;
    setNavigationPending(false);
  });
  return navigating;
}

/** Full-document navigation happens only after every registered editor/profile
 * guard approves. Concurrent clicks cannot race toward different destinations. */
export function navigateWorkspace(href: string): Promise<boolean> {
  const destination = workspaceDestination(href);
  if (!destination) return Promise.resolve(false);
  return navigationAction(async () => {
    for (let pass = 0; pass < 4; pass++) {
      if (!(await prepareWorkspaceNavigation())) return false;
      if (preparedRevision === guardRevision) return assignApproved(destination);
    }
    return false;
  });
}

/** Do not rerun save guards after credentials have already been revoked. */
export function signOutWorkspace(): Promise<boolean> {
  return navigationAction(async () => {
    if (!(await prepareWorkspaceNavigation()) || !(await requestSafeLogout())) return false;
    return assignApproved("/login");
  });
}
