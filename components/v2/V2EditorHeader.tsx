"use client";

import type { ReactNode } from "react";
import { ArrowLeft, BarChart3, Eye, FileText, MoreHorizontal, Paintbrush, Plug, Share2, Upload } from "lucide-react";
import { navigateWorkspace } from "@/lib/workspace-navigation";
import type { EditorSection } from "@/lib/editor-navigation";
import "./editor.css";
import EditorModeSwitch from "../EditorModeSwitch";

export interface V2EditorHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  saveLabel: string;
  publicationLabel: string;
  activeSection: EditorSection;
  onSectionChange: (section: EditorSection) => void;
  onBasicMode: () => void;
  onDesign: () => void;
  onPreview: () => void;
  onPublish: () => void;
  previewing?: boolean;
  publishing?: boolean;
  actions?: ReactNode;
}

export default function V2EditorHeader(props: V2EditorHeaderProps) {
  const connect = props.activeSection === "integrate" || props.activeSection === "marketing";
  const results = props.activeSection === "results" || props.activeSection === "contacts";
  return <header className="v2-editor-header">
    <div className="v2-editor-titlebar">
      <button type="button" className="v2-editor-back" onClick={() => void navigateWorkspace("/")}><ArrowLeft size={16} /> <span>All quizzes</span></button>
      <div className="v2-editor-identity">
        <input aria-label="Quiz name" value={props.title} onChange={event => props.onTitleChange(event.target.value)} />
        <div className="v2-editor-status" role="status"><span>{props.saveLabel}</span><span aria-hidden="true">·</span><span>{props.publicationLabel}</span></div>
      </div>
      <div className="v2-editor-header-actions">
        <EditorModeSwitch basic={false} onChange={basic => { if (basic) props.onBasicMode(); }} />
        <button type="button" className="v2-editor-button v2-editor-share" aria-pressed={props.activeSection === "share"} onClick={() => props.onSectionChange("share")}><Share2 size={16} />Share</button>
        <button type="button" className="v2-editor-button" disabled={props.previewing} onClick={props.onPreview}><Eye size={16} />{props.previewing ? "Preparing…" : "Preview"}</button>
        <button type="button" className="v2-editor-button is-primary" data-publication-action="publish" disabled={props.publishing} onClick={props.onPublish}><Upload size={16} />Publish</button>
      </div>
    </div>
    <nav className="v2-editor-workflow" aria-label="Quiz workspace">
      <button type="button" aria-current={props.activeSection === "edit" ? "page" : undefined} onClick={() => props.onSectionChange("edit")}><FileText size={16} />Build</button>
      <button type="button" onClick={props.onDesign}><Paintbrush size={16} />Design</button>
      <button type="button" aria-current={connect ? "page" : undefined} onClick={() => props.onSectionChange("integrate")}><Plug size={16} />Connect</button>
      <button type="button" aria-current={results ? "page" : undefined} onClick={() => props.onSectionChange("results")}><BarChart3 size={16} />Results</button>
      <details className="v2-editor-tools"><summary aria-label="More editor tools"><MoreHorizontal size={19} /><span>More</span></summary><div className="v2-editor-tools-menu" onClick={event => { if (event.target instanceof Element && event.target.closest("button")) event.currentTarget.closest("details")?.removeAttribute("open"); }}><button type="button" onClick={() => props.onSectionChange("share")}>Share & embed</button>{props.actions}</div></details>
    </nav>
    {connect && <nav className="v2-editor-subnav" aria-label="Connection tools"><button type="button" aria-current={props.activeSection === "integrate" ? "page" : undefined} onClick={() => props.onSectionChange("integrate")}>Integrations & tracking</button><button type="button" aria-current={props.activeSection === "marketing" ? "page" : undefined} onClick={() => props.onSectionChange("marketing")}>Marketing</button></nav>}
    {results && <nav className="v2-editor-subnav" aria-label="Quiz results"><button type="button" aria-current={props.activeSection === "results" ? "page" : undefined} onClick={() => props.onSectionChange("results")}>Overview</button><button type="button" aria-current={props.activeSection === "contacts" ? "page" : undefined} onClick={() => props.onSectionChange("contacts")}>Contacts & lead capture</button></nav>}
  </header>;
}
