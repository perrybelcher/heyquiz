import { z } from "zod";
export const trackingEvents = ["quiz_start", "question_view", "quiz_complete", "lead_captured", "result_view", "offer_click"] as const;
export type TrackingEvent = typeof trackingEvents[number];
export const trackingLabels: Record<TrackingEvent, string> = { quiz_start: "Quiz started", question_view: "Question viewed", quiz_complete: "Quiz completed", lead_captured: "Lead captured", result_view: "Results viewed", offer_click: "Offer clicked" };
export const TrackingSchema = z.object({
    enabled: z.boolean().default(false),
    ga4Id: z.string().regex(/^(G-[A-Z0-9]{4,20})?$/, "Use a GA4 measurement ID such as G-ABC1234567.").default(""),
    metaPixelId: z.string().regex(/^([0-9]{5,30})?$/, "Use the numeric Meta pixel ID.").default(""),
    events: z.array(z.enum(trackingEvents)).max(6).default([...trackingEvents]),
    questionIds: z.array(z.string().max(128)).max(200).default([]),
    privacyUrl: z.string().max(2000).refine(v => !v || /^https:\/\//i.test(v), "Use an HTTPS privacy-policy URL.").default(""),
}).refine(v => !v.enabled || Boolean(v.ga4Id || v.metaPixelId), "Add a tracker ID before enabling tracking.");
export type TrackingConfig = z.infer<typeof TrackingSchema>;
export const defaultTracking: TrackingConfig = { enabled: false, ga4Id: "", metaPixelId: "", events: [...trackingEvents], questionIds: [], privacyUrl: "" };
