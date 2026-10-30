"use client";
import { Component, type ReactNode } from "react";
import { reportInterfaceEvent } from "@/lib/interface-telemetry";

/** A canvas failure must not strand the draft or prevent returning to its editor. */
export default class FlowErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { reportInterfaceEvent("flow_editor_failed", "v2"); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-50 p-6">
      <section className="max-w-md space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">The flow canvas could not be displayed.</h2>
        <p>Your draft is still available in the quiz editor. Return to it to save your work and try again.</p>
        <button type="button" className="hq-primary rounded-lg px-4 py-3" onClick={this.props.onClose}>Return to editor</button>
      </section>
    </div>;
  }
}
