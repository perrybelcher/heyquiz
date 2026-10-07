"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Webhook,
  X,
} from "lucide-react";
import type { FormSchemaType } from "@/lib/schema";
import type {
  IntegrationDraft,
  IntegrationView,
  DeliveryJob,
} from "@/lib/integrations/schema";
import Connections from "./Connections";
type History = Omit<DeliveryJob, "event"> & { responseId: string };
type Data = {
  connections: IntegrationView[];
  deliveries: History[];
  schedulerConfigured: boolean;
  schedulerCadence: string;
  deliveryAllowed: boolean;
};
const empty = (provider: "webhook" | "gohighlevel"): IntegrationDraft => ({
  provider,
  name: provider === "gohighlevel" ? "GoHighLevel" : "Webhook",
  revision: 0,
  enabled: false,
  consentOnly: true,
  locationId: "",
  tags: [],
  resultTag: false,
  mappings: [],
});
const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const buttonClass =
  "rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";
export default function IntegrationStudio({ form }: { form: FormSchemaType }) {
  const [data, setData] = useState<Data | null>(null),
    [draft, setDraft] = useState<IntegrationDraft | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [testId, setTestId] = useState<string | null>(null);
  const endpoint = `/api/forms/${form.id}/integrations`;
  const refresh = useCallback(async () => {
    const r = await fetch(endpoint),
      body = await r.json();
    if (!r.ok) throw Error(body.error || "Could not load connections.");
    setData(body);
  }, [endpoint]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => refresh().catch(() => {}), 8000);
    return () => clearInterval(timer);
  }, [refresh]);
  function patch(change: Partial<IntegrationDraft>) {
    setDraft((d) => (d ? { ...d, ...change } : d));
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            tags: draft.tags.map((t) => t.trim()).filter(Boolean),
          }),
        }),
        b = await r.json();
      if (!r.ok) throw Error(b.error || "Could not save connection.");
      setDraft(null);
      await refresh();
      setNotice(
        b.enabled
          ? "Connection enabled for new leads. Existing contacts are not backfilled."
          : "Connection saved and paused. Send a test before enabling it.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  async function action(action: "test" | "retry" | "dispatch", id?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, id }),
        }),
        b = await r.json();
      if (!r.ok) throw Error(b.error || "Could not queue delivery.");
      setTestId(null);
      await refresh();
      setNotice("Queued. Delivery history will update automatically.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const sources = [
    ["contact.email", "Email"],
    ["contact.name", "Name"],
    ["contact.phone", "Phone"],
    ["contact.marketingConsent", "Marketing consent"],
    ["contact.recordedAt", "Consent recorded at"],
    ["contact.consentText", "Consent wording"],
    ["result.title", "Result / recommended product"],
    ["result.outcomeId", "Segment / product ID"],
    ["result.categories", "Category scores (JSON)"],
    ["score", "Quiz score (%)"],
    ["responseId", "Response ID"],
    ["formId", "Quiz ID"],
    ["submittedAt", "Submitted at"],
    ...form.questions
      .filter((q) => !["password", "captcha"].includes(q.type))
      .map((q) => [`answers.${q.id}`, `Answer: ${q.title}`]),
  ];
  return (
    <main className="max-w-5xl mx-auto p-5 sm:p-10 space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold mb-2">
            From answers to action
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Lead integrations
          </h1>
          <p className="text-slate-500 mt-3 max-w-2xl">
            Send quiz results to the tools that power your follow-up. Choose
            what to share, test the connection, and see every delivery.
          </p>
        </div>
        <span className="flex items-center gap-2 text-xs text-slate-500 rounded-full border bg-white px-3 py-2">
          <ShieldCheck size={15} /> Credentials encrypted
        </span>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm"
        >
          {notice}
        </p>
      )}
      {!form.capture?.enabled && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Enable lead capture in Contacts to collect the email and consent
          needed for delivery.
        </p>
      )}
      {data && !data.deliveryAllowed && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Outbound delivery is disabled on preview deployments. Use local tests
          or the production app.
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          {
            provider: "gohighlevel" as const,
            title: "GoHighLevel",
            copy: "Create or update contacts, map custom fields, and add segment tags.",
            icon: Link2,
          },
          {
            provider: "webhook" as const,
            title: "Webhooks",
            copy: "Send results to Zapier, Make, or your own HTTPS destination.",
            icon: Webhook,
          },
        ].map((c) => (
          <article
            key={c.provider}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <c.icon size={25} className="text-indigo-600 mb-4" />
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="text-sm text-slate-500 mt-2 mb-5">{c.copy}</p>
            <button
              className={buttonClass}
              onClick={() => {
                setDraft(empty(c.provider));
                setError("");
                setNotice("");
              }}
            >
              <span className="flex items-center gap-2">
                <Plus size={15} /> Add connection
              </span>
            </button>
          </article>
        ))}
      </div>
      {draft && (
        <section
          aria-label="Connection setup"
          className="rounded-2xl border border-indigo-200 bg-white p-5 sm:p-7 space-y-5"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {draft.id ? "Edit" : "Connect"}{" "}
              {draft.provider === "gohighlevel" ? "GoHighLevel" : "webhook"}
            </h2>
            <button
              aria-label="Close connection setup"
              onClick={() => setDraft(null)}
              className="p-2"
              disabled={busy}
            >
              <X size={20} />
            </button>
          </div>
          <label className="block text-sm font-medium space-y-2">
            <span>Connection name</span>
            <input
              className={inputClass}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          {draft.provider === "webhook" ? (
            <>
              <label className="block text-sm font-medium space-y-2">
                <span>Webhook URL</span>
                <input
                  type="password"
                  autoComplete="off"
                  className={inputClass}
                  value={draft.url || ""}
                  placeholder={
                    draft.id
                      ? "Saved securely — leave blank to keep"
                      : "https://hooks.example.com/…"
                  }
                  onChange={(e) => patch({ url: e.target.value || undefined })}
                />
              </label>
              <label className="block text-sm font-medium space-y-2">
                <span>Signing secret (optional)</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={draft.signingSecret || ""}
                  placeholder={
                    draft.id
                      ? "Leave blank to keep the saved secret"
                      : "At least 16 characters"
                  }
                  onChange={(e) =>
                    patch({ signingSecret: e.target.value || undefined })
                  }
                />
              </label>
              <p className="text-xs text-slate-500">
                The JSON includes contact, consent, answers, result, category
                scores, and mapped fields. Campaign values collected by hidden
                questions are included in answers.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Use a sub-account private integration token with Contacts
                read/write access. This version uses a token connection;
                marketplace OAuth is not yet available.
              </p>
              <label className="block text-sm font-medium space-y-2">
                <span>Location ID</span>
                <input
                  className={inputClass}
                  value={draft.locationId}
                  onChange={(e) => patch({ locationId: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium space-y-2">
                <span>Private integration token</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={draft.token || ""}
                  placeholder={
                    draft.id
                      ? "Saved securely — leave blank to keep"
                      : "Paste your sub-account token"
                  }
                  onChange={(e) =>
                    patch({ token: e.target.value || undefined })
                  }
                />
              </label>
              <label className="block text-sm font-medium space-y-2">
                <span>Tags to add (comma separated)</span>
                <input
                  className={inputClass}
                  value={draft.tags.join(",")}
                  placeholder="heyquiz-lead"
                  onChange={(e) => patch({ tags: e.target.value.split(",") })}
                />
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.resultTag}
                  onChange={(e) => patch({ resultTag: e.target.checked })}
                />{" "}
                Add a heyquiz- tag using the result’s segment or product ID
              </label>
              <p className="text-xs text-slate-500">
                Existing tags and unsubscribe settings are preserved. Tags may
                trigger automations in your HighLevel account.
              </p>
            </>
          )}
          <div className="border-t pt-5 space-y-3">
            <h3 className="font-semibold">
              {draft.provider === "gohighlevel"
                ? "Custom field mapping"
                : "Additional field mapping"}
            </h3>
            <p className="text-sm text-slate-500">
              {draft.provider === "gohighlevel"
                ? "Email, name, and phone map automatically. Enter existing HighLevel custom field IDs for quiz data; use text fields for JSON category scores."
                : "Choose friendly names for values in the payload’s fields object."}
            </p>
            {draft.mappings.map((m, i) => (
              <div
                key={i}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2"
              >
                <select
                  aria-label={`Source field ${i + 1}`}
                  className={inputClass}
                  value={m.source}
                  onChange={(e) =>
                    patch({
                      mappings: draft.mappings.map((v, n) =>
                        n === i ? { ...v, source: e.target.value } : v,
                      ),
                    })
                  }
                >
                  {sources.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <ArrowUpRight
                  size={16}
                  className="hidden sm:block shrink-0 text-slate-400"
                />
                <input
                  aria-label={`Destination field ${i + 1}`}
                  className={inputClass}
                  placeholder={
                    draft.provider === "gohighlevel"
                      ? "HighLevel custom field ID"
                      : "e.g. quiz_result"
                  }
                  value={m.target}
                  onChange={(e) =>
                    patch({
                      mappings: draft.mappings.map((v, n) =>
                        n === i ? { ...v, target: e.target.value } : v,
                      ),
                    })
                  }
                />
                <button
                  className="p-2"
                  aria-label={`Remove mapping ${i + 1}`}
                  onClick={() =>
                    patch({
                      mappings: draft.mappings.filter((_, n) => i !== n),
                    })
                  }
                >
                  <X size={17} />
                </button>
              </div>
            ))}
            <button
              className={buttonClass}
              onClick={() =>
                patch({
                  mappings: [
                    ...draft.mappings,
                    { source: "result.title", target: "" },
                  ],
                })
              }
            >
              Add field mapping
            </button>
          </div>
          <div className="border-t pt-5 space-y-3">
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.consentOnly}
                disabled={draft.provider === "gohighlevel"}
                onChange={(e) => patch({ consentOnly: e.target.checked })}
              />{" "}
              Only send leads who opt in to marketing
            </label>
            {!draft.consentOnly && (
              <p className="text-sm text-amber-800">
                The webhook will receive all captured leads, including those who
                declined marketing. Your receiving workflow must check
                marketingConsent before sending marketing.
              </p>
            )}
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />{" "}
              Enable delivery for new leads
            </label>
            <p className="text-xs text-slate-500">
              Changes take effect when saved, independently of Publish. Existing
              contacts are not backfilled. Pending jobs from an older connection
              version require a manual retry.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              disabled={busy}
              onClick={() => void save()}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save connection"}
            </button>
            <button
              className={buttonClass}
              onClick={() => setDraft(null)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your connections</h2>
        {!data ? (
          <p className="text-slate-500">Loading connections…</p>
        ) : !data.connections.length ? (
          <div className="rounded-2xl border border-dashed p-7 text-sm text-slate-500">
            No destinations connected yet. Add one above, send a test, then
            enable delivery.
          </div>
        ) : (
          data.connections.map((c) => (
            <article
              key={c.id}
              className="rounded-2xl border bg-white p-5 flex flex-wrap justify-between items-center gap-4"
            >
              <div>
                <h3 className="font-semibold">
                  {c.name}{" "}
                  <span
                    className={`ml-2 rounded-full px-2 py-1 text-xs ${c.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {c.enabled ? "Enabled" : "Paused"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-2 break-all">
                  {c.destination} ·{" "}
                  {c.consentOnly ? "Opted-in leads only" : "All captured leads"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={buttonClass}
                  onClick={() => {
                    setDraft({ ...c });
                    setError("");
                  }}
                >
                  Edit
                </button>
                <button
                  className={buttonClass}
                  disabled={busy || !data.deliveryAllowed}
                  onClick={() => setTestId(c.id)}
                >
                  Send test
                </button>
              </div>
            </article>
          ))
        )}
      </section>
      {testId && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 space-y-3">
          <h3 className="font-semibold">
            Send a synthetic test to{" "}
            {data?.connections.find((c) => c.id === testId)?.name}?
          </h3>
          <p className="text-sm text-slate-600">
            This sends heyquiz-test@example.com and example answers. HighLevel
            will create or update that test contact, without adding tags.
            Existing destination automations may still run.
          </p>
          <div className="flex gap-2">
            <button
              className={buttonClass}
              disabled={busy}
              onClick={() => action("test", testId)}
            >
              Send synthetic test
            </button>
            <button className={buttonClass} onClick={() => setTestId(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      <section className="rounded-2xl border bg-white p-5 sm:p-7 space-y-4">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-semibold">Delivery history</h2>
          <button
            className={buttonClass}
            disabled={busy || !data?.deliveryAllowed}
            onClick={() => action("dispatch")}
          >
            <span className="flex gap-2 items-center">
              <RefreshCw size={14} /> Process due deliveries
            </span>
          </button>
        </div>
        <p className="text-sm text-slate-500">
          New leads send after submission. Temporary failures retry up to six
          times when the worker runs. Showing the latest 100 deliveries.
        </p>
        {data && !data.schedulerConfigured && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Scheduled retries need server setup. New submissions and “Process
            due deliveries” run the queue now; unattended retries require the
            scheduler.
          </p>
        )}
        {data?.schedulerConfigured && (
          <p className="text-xs text-slate-500">
            {data.schedulerCadence === "minute"
              ? "Automatic retry worker runs every minute."
              : "The bundled schedule runs daily. Configure a minute-level worker for prompt retries during quiet periods."}
          </p>
        )}
        {!data?.deliveries.length ? (
          <p className="py-5 text-sm text-slate-500">
            Your tests and lead deliveries will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {data.deliveries.map((j) => (
              <article key={j.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium text-sm">
                    {j.connectionName}
                    {j.test && (
                      <span className="ml-2 text-xs text-slate-500">Test</span>
                    )}
                  </p>
                  <span
                    className={`text-xs font-semibold ${j.state === "delivered" ? "text-emerald-700" : j.state === "failed" ? "text-rose-700" : "text-slate-500"}`}
                  >
                    {j.state === "delivered" && (
                      <Check size={12} className="inline mr-1" />
                    )}
                    {j.state}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-2">{j.lastMessage}</p>
                <p className="text-xs text-slate-400 mt-2 break-all">
                  {new Date(j.createdAt).toLocaleString()} · {j.attempts}{" "}
                  attempts · {j.responseId}
                </p>
                {j.state === "pending" && (
                  <p className="text-xs text-slate-500 mt-1">
                    Eligible after {new Date(j.nextAttemptAt).toLocaleString()}
                  </p>
                )}
                {["pending", "failed"].includes(j.state) && (
                  <button
                    className={`${buttonClass} mt-3`}
                    disabled={busy || !data.deliveryAllowed}
                    onClick={() => action("retry", j.id)}
                  >
                    Retry with current connection
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <details className="rounded-2xl border bg-slate-50">
        <summary className="cursor-pointer p-5 text-sm font-medium">
          Workspace services
        </summary>
        <Connections />
      </details>
    </main>
  );
}
