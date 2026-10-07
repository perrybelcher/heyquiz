import { z } from "zod";
import { nangoProviders, isNangoProvider, validMapping, providers } from "./providers";
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const source = z
  .string()
  .max(160)
  .regex(
    /^(contact\.(email|name|phone|marketingConsent|recordedAt|consentText)|result\.(title|outcomeId|kind|status|categories)|score|responseId|formId|submittedAt|answers\.[a-zA-Z0-9_-]+)$/,
  );
export const IntegrationInput = z
  .object({
    id: identifier.optional(),
    revision: z.number().int().min(0).default(0),
    name: z.string().trim().min(1).max(100),
    provider: z.enum(["webhook", "gohighlevel", ...nangoProviders]),
    audienceId: z.string().regex(/^[a-zA-Z0-9_-]*$/).max(128).optional(),
    enabled: z.boolean().default(false),
    consentOnly: z.boolean().default(true),
    url: z.string().trim().max(2048).optional(),
    token: z.string().trim().max(4096).optional(),
    signingSecret: z.string().min(16).max(256).optional(),
    locationId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]*$/)
      .max(128)
      .default(""),
    tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    resultTag: z.boolean().default(false),
    mappings: z
      .array(
        z.object({
          source,
          target: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,128}$/)
            .refine(
              (v) => !["__proto__", "constructor", "prototype"].includes(v),
              "Reserved destination field.",
            ),
        }),
      )
      .max(40)
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.mappings.map((m) => m.target)).size !== v.mappings.length)
      ctx.addIssue({
        code: "custom",
        message: "Each destination field can only be mapped once.",
      });
    if (v.provider === "gohighlevel" && !v.locationId)
      ctx.addIssue({
        code: "custom",
        message: "Enter the HighLevel location ID.",
      });
    if (v.provider !== "webhook" && !v.consentOnly)
      ctx.addIssue({
        code: "custom",
        message: "CRM delivery requires marketing opt-in in this version.",
      });
    if (isNangoProvider(v.provider) && v.mappings.some((m) => !validMapping(v.provider as typeof nangoProviders[number], m.target)))
      ctx.addIssue({ code: "custom", message: providers[v.provider].mappingHelp });
    if (v.provider === "mailchimp" && !v.audienceId)
      ctx.addIssue({ code: "custom", message: "Enter the Mailchimp audience ID." });

  });
export type IntegrationDraft = z.infer<typeof IntegrationInput>;
export interface IntegrationConfig
  extends Omit<
    IntegrationDraft,
    "id" | "revision" | "url" | "token" | "signingSecret"
  > {
  id: string;
  formId: string;
  secretBox: string;
  destination: string;
  createdAt: string;
  updatedAt: string;
  activeFrom: string;
}
export interface IntegrationView extends Omit<IntegrationConfig, "secretBox"> {
  revision: number;
  credentialsSaved: boolean;
}
export interface LeadEvent {
  schemaVersion: 1;
  event: "lead.captured" | "connection.test";
  eventId: string;
  responseId: string;
  formId: string;
  submittedAt: string;
  score: number;
  contact: {
    email: string;
    name?: string;
    phone?: string;
    marketingConsent: boolean;
    recordedAt: string;
    consentText: string;
    privacyUrl?: string;
    purposeText?: string;
    formRevision?: number;
    placement?: string;
  };
  result: {
    kind?: string;
    status?: string;
    title?: string;
    outcomeId?: string;
    categories?: unknown[];
  };
  answers: Record<string, unknown>;
  fields: Record<string, unknown>;
}
export interface DeliveryJob {
  id: string;
  formId: string;
  connectionId: string;
  connectionName: string;
  connectionRevision: number;
  event: LeadEvent;
  state: "pending" | "sending" | "delivered" | "failed" | "skipped";
  attempts: number;
  createdAt: string;
  nextAttemptAt: number;
  leaseUntil?: number;
  lastMessage: string;
  lastStatus?: number;
  deliveredAt?: string;
  remoteContactId?: string;
  test: boolean;
}
