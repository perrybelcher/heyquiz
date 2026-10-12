import type { CSSProperties } from "react";
import type { BrandFont, FormTheme } from "./schema";

export const brandFonts: Record<BrandFont, { label: string; family: string }> = {
  system: { label: "System sans", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  arial: { label: "Arial", family: "Arial, Helvetica, sans-serif" },
  verdana: { label: "Verdana", family: "Verdana, Geneva, sans-serif" },
  trebuchet: { label: "Trebuchet", family: "'Trebuchet MS', Arial, sans-serif" },
  georgia: { label: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  palatino: { label: "Palatino", family: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
  mono: { label: "Monospace", family: "ui-monospace, SFMono-Regular, Consolas, monospace" },
};

/** Shared by the live player and theme preview so settings render consistently. */
export function quizThemeStyle(theme: FormTheme): CSSProperties & Record<string, string> {
  const primary = theme.primaryColor || "#c62121";
  const rgb = /^#[0-9a-f]{6}$/i.test(primary) ? [1,3,5].map(i => parseInt(primary.slice(i,i+2),16)/255) : [0,0,0];
  const linear = rgb.map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  const luminance = .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  const legacyFont = theme.font === "serif" ? "georgia" : theme.font === "mono" ? "mono" : "arial";
  const bodyFont = brandFonts[theme.bodyFont || legacyFont].family;
  return {
    "--hq-primary": primary,
    "--hq-heading-font": brandFonts[theme.headingFont || theme.bodyFont || legacyFont].family,
    "--hq-body-size": `${theme.bodySize || 16}px`,
    "--hq-heading-scale": String(theme.headingScale || 1),
    "--hq-text": theme.textColor || "#172033",
    "--hq-button-text": luminance > .179 ? "#111111" : "#ffffff",
    "--hq-card": theme.cardColor || "#ffffff",
    "--hq-radius": {none:"0px",md:"12px",lg:"24px",full:"32px"}[theme.borderRadius || "lg"],
    fontFamily: bodyFont,
    backgroundColor: theme.backgroundColor || "#f6f7fb",
    color: theme.textColor || "#172033",
  };
}
