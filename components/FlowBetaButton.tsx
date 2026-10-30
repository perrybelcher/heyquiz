"use client";
import { GitBranch } from "lucide-react";
import "./flow-beta-button.css";

/** Shared entry point follows each editor header's existing button styling. */
export default function FlowBetaButton({ onClick, className = "hq-secondary" }: {
  onClick: () => void;
  className?: string;
}) {
  return <button type="button" className={`${className} flow-beta-button`} onClick={onClick} aria-haspopup="dialog">
    <GitBranch size={16} aria-hidden="true" /><span>Flow <span className="flow-beta-label">(Beta)</span></span>
  </button>;
}
