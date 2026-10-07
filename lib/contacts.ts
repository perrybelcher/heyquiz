import { z } from "zod";
export const CaptureSchema = z.object({
    enabled: z.boolean(), placement: z.enum(["before_results", "after_results"]), required: z.boolean(),
    name: z.enum(["off", "optional", "required"]), phone: z.enum(["off", "optional", "required"]),
    title: z.string().min(1).max(160), description: z.string().max(1000), buttonText: z.string().min(1).max(80),
    marketingEnabled: z.boolean(), marketingLabel: z.string().min(1).max(500),
    privacyUrl: z.string().max(2000).refine(v => !v || /^https?:\/\//i.test(v), "Use an HTTPS or HTTP privacy URL."),
}).refine(v => !(v.placement === "after_results" && v.required), "Capture after results must be optional.");
export type CaptureConfig = z.infer<typeof CaptureSchema>;
export const defaultCapture: CaptureConfig = { enabled: false, placement: "before_results", required: false, name: "optional", phone: "off", title: "Your next step is ready", description: "Share your details to connect your results with you.", buttonText: "See my results", marketingEnabled: true, marketingLabel: "Yes, I would like to receive marketing emails.", privacyUrl: "" };
export interface ContactInput {
    email: string;
    name?: string;
    phone?: string;
    marketingConsent: boolean;
}
export interface ContactRecord extends ContactInput {
    recordedAt: string;
    consentText: string;
    placement: CaptureConfig["placement"];
    privacyUrl: string;
    formRevision: number;
    purposeText: string;
}
export function parseContact(config: CaptureConfig | undefined, input: unknown, revision = 0): ContactRecord | undefined {
    if (!config?.enabled)
        return undefined;
    if (input == null) {
        if (config.required)
            throw Error("Please enter your contact details to see your results.");
        return undefined;
    }
    const value = z.object({ email: z.string().trim().email().max(254), name: z.string().trim().max(160).optional(), phone: z.string().trim().max(50).optional(), marketingConsent: z.boolean() }).parse(input);
    for (const field of ["name", "phone"] as const) {
        if (config[field] === "required" && !value[field])
            throw Error(`Please enter your ${field}.`);
        if (config[field] === "off")
            delete value[field];
    }
    return { ...value, email: value.email.toLowerCase(), marketingConsent: config.marketingEnabled && value.marketingConsent, recordedAt: new Date().toISOString(), consentText: config.marketingEnabled ? config.marketingLabel : "", placement: config.placement, privacyUrl: config.privacyUrl, formRevision: revision, purposeText: config.description };
}
export function contactsCsv(rows: Record<string, unknown>[]) {
    if (!rows.length)
        return "";
    const keys = Object.keys(rows[0]);
    const cell = (v: unknown) => { let s = typeof v === "object" ? JSON.stringify(v) : String(v ?? ""); if (/^[\s]*[=+@-]/.test(s))
        s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
    return [keys.map(cell).join(","), ...rows.map(r => keys.map(k => cell(r[k])).join(","))].join("\r\n");
}
