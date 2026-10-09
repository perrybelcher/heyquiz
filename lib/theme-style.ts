import type { CSSProperties } from "react";
import type { FormTheme } from "./schema";

/** Shared by the live player and theme preview so settings render consistently. */
export function quizThemeStyle(theme: FormTheme): CSSProperties & Record<string, string> {
  const primary = theme.primaryColor || "#c62121";
  const rgb = /^#[0-9a-f]{6}$/i.test(primary) ? [1,3,5].map(i => parseInt(primary.slice(i,i+2),16)/255) : [0,0,0];
  const linear = rgb.map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  const luminance = .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  return {
    "--hq-primary": primary,
    "--hq-text": theme.textColor || "#172033",
    "--hq-button-text": luminance > .179 ? "#111111" : "#ffffff",
    "--hq-card": theme.cardColor || "#ffffff",
    "--hq-radius": {none:"0px",md:"12px",lg:"24px",full:"32px"}[theme.borderRadius || "lg"],
    fontFamily: theme.font === "serif" ? "Georgia, serif" : theme.font === "mono" ? "ui-monospace, monospace" : "Arial, Helvetica, sans-serif",
    backgroundColor: theme.backgroundColor || "#f6f7fb",
    color: theme.textColor || "#172033",
  };
}
