import { z } from "zod";
import { FormThemeSchema } from "./schema";
/** Visual kits are copied into a draft. Updating a kit never mutates a published quiz. */
export const VisualBrandKitInput = z.object({
    name: z.string().trim().min(1).max(100),
    theme: FormThemeSchema.superRefine((theme, ctx) => {
        for (const key of ["primaryColor", "backgroundColor", "cardColor", "textColor"] as const) {
            if (theme[key] && !/^#[0-9a-f]{6}$/i.test(theme[key]!))
                ctx.addIssue({ code: "custom", path: [key], message: "Use a six-digit hex color." });
        }
        if (theme.logoUrl && !theme.logoAlt?.trim() && !theme.brandName?.trim())
            ctx.addIssue({ code: "custom", path: ["logoAlt"], message: "Give your logo a name for screen readers." });
    }),
});
export const VisualBrandKitUpdate = VisualBrandKitInput.extend({ revision: z.number().int().positive() });
export const VisualBrandKitRename = VisualBrandKitInput.pick({ name: true }).extend({ revision: z.number().int().positive() }).strict();
export const VisualBrandKitDelete = z.object({ revision: z.number().int().positive() }).strict();
export type VisualBrandKitData = z.infer<typeof VisualBrandKitInput> & {
    updatedAt: string;
};
export type VisualBrandKit = VisualBrandKitData & {
    id: string;
    revision: number;
};
// Replacing a kit with a minimal tombstone is an atomic, revision-checked delete.
// Keeping its record version prevents a concurrent stale update from reviving it;
// the deleted logo, name and theme are not retained in the tombstone.
export type StoredVisualBrandKit = VisualBrandKitData | { deletedAt: string };
export function isActiveVisualBrandKit(kit: StoredVisualBrandKit): kit is VisualBrandKitData {
    return !("deletedAt" in kit);
}
