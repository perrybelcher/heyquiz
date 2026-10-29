"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useInterfaceVersion } from "./v2/InterfaceContext";
import "./v2/data.css";

export default function ReportTabs({ analytics, responses }: { analytics: ReactNode; responses: ReactNode }) {
  const v2 = useInterfaceVersion() === "v2";
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className={v2 ? "v2-report-tabs mt-7" : "mt-7"}>
    <div role="tablist" aria-label="Quiz report views" className="flex w-fit gap-1 rounded-xl bg-stone-100 p-1" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - active;
      setActive(next); buttons.current[next]?.focus();
    }}>{["Analytics", "Responses"].map((label, index) => <button key={label} ref={element => { buttons.current[index] = element; }} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={active === index} aria-controls={`${id}-panel-${index}`} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} className={`rounded-lg px-5 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#922c3b] ${active === index ? "bg-white text-[#852d3d] shadow-sm" : "text-slate-500"}`}>{label}</button>)}</div>
    <div id={`${id}-panel-0`} role="tabpanel" aria-labelledby={`${id}-tab-0`} hidden={active !== 0}>{analytics}</div>
    <div id={`${id}-panel-1`} role="tabpanel" aria-labelledby={`${id}-tab-1`} hidden={active !== 1}>{responses}</div>
  </div>;
}
