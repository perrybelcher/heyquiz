"use client";
import { memo, createContext, useContext, useEffect, useRef } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { GripVertical, Flag, Pencil, Plus, ArrowRight } from "lucide-react";
export type BlockData = {
  title: string;
  label: string;
  answers: { id: string; label: string; destinationLabel?: string; destinationId?: string; inherited?: boolean }[];
  readOnly: boolean;
  activePort?: string;
};
export type BlockNode = Node<BlockData>;
export const FlowActions = createContext<{
  edit: (id: string) => void;
  port: (id: string, handle: string) => void;
  target: (id: string) => void;
  choose?: (id: string, handle: string) => void;
  goTo?: (id: string) => void;
}>({ edit: () => {}, port: () => {}, target: () => {} });
export const QuestionNode = memo(function QuestionNode({
  id,
  data,
  selected,
}: NodeProps<BlockNode>) {
  const actions = useContext(FlowActions),
    update = useUpdateNodeInternals(),
    count = useRef(data.answers.length);
  useEffect(() => {
    if (count.current !== data.answers.length) {
      count.current = data.answers.length;
      update(id);
    }
  }, [id, data.answers.length, update]);
  return (
    <article className={`flow-question ${selected ? "selected" : ""}`} onClick={event => { if (!(event.target as HTMLElement).closest("button,.react-flow__handle,.flow-node-grip")) actions.edit(id); }}>
      <Handle type="target" position={Position.Left} />
      <button
        className="flow-input nodrag"
        aria-label={`Connect to ${data.title}`}
        onClick={() => actions.target(id)}
      />
      <header className="flow-node-heading">
        <span className="flow-node-grip" title="Drag to move question"><GripVertical size={18} aria-hidden="true" /></span>
        <button className="flow-question-title nodrag" onClick={() => actions.edit(id)} aria-label={`Edit ${data.title || "Untitled question"}`}>
          <small>{data.label}</small>
          <h3>{data.title || "Untitled question"}</h3>
        </button>
        <button
          className="nodrag"
          aria-label={`Edit question settings for ${data.title}`}
          onClick={() => actions.edit(id)}
        >
          <Pencil size={17} aria-hidden="true" />
        </button>
      </header>
      <div className="flow-answers">
        {data.answers.map((a, i) => (
          <div
            className={`flow-answer ${data.activePort === a.id ? "active" : ""}`}
            key={a.id}
          >
            <span className="flow-letter">
              {a.id === "default" ? "→" : String.fromCharCode(65 + i)}
            </span>
            <div className="flow-answer-copy">
              <span className="flow-answer-name">{a.label}</span>
              <button className={`flow-destination nodrag${a.destinationLabel ? "" : " flow-destination--missing"}`} disabled={data.readOnly && !a.destinationId} aria-label={a.destinationId ? `Go to ${a.destinationLabel || "destination"}${a.inherited ? " via default route" : ""}` : `Choose destination for ${a.label}`} onClick={() => a.destinationId && actions.goTo ? actions.goTo(a.destinationId) : (actions.choose || actions.port)(id, a.id)} title={a.destinationLabel}>
                {a.destinationLabel ? <><ArrowRight size={12} aria-hidden="true" /><span>{a.inherited ? "Default: " : ""}{a.destinationLabel}</span></> : <><Plus size={12} aria-hidden="true" /><span>Choose destination</span></>}
              </button>
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id={a.id}
              isConnectable={!data.readOnly}
            />
            <button
              className="flow-port nodrag"
              title={a.destinationLabel ? "Change destination or add a step" : "Add next step"}
              disabled={data.readOnly}
              aria-label={`Connect ${a.label}`}
              onClick={() => (actions.choose || actions.port)(id, a.id)}
            ><Plus size={17} aria-hidden="true" /></button>
          </div>
        ))}
      </div>
    </article>
  );
});
export const ResultNode = memo(function ResultNode({
  id,
  data,
  selected,
}: NodeProps<BlockNode>) {
  const actions = useContext(FlowActions);
  return (
    <article className={`flow-result ${selected ? "selected" : ""}`} onClick={event => { if (!(event.target as HTMLElement).closest("button,.react-flow__handle,.flow-node-grip")) actions.edit(id); }}>
      <Handle type="target" position={Position.Left} />
      <button
        className="flow-input nodrag"
        aria-label={`Connect to ${data.title}`}
        onClick={() => actions.target(id)}
      />
      <span className="flow-node-grip" title="Drag to move result"><GripVertical size={18} aria-hidden="true" /></span>
      <Flag size={25} aria-hidden="true" />
      <div>
        <small>{data.label}</small>
        <h3>{data.title}</h3>
      </div>
      <button
        aria-label={`Edit ${data.title}`}
        className="nodrag"
        onClick={() => actions.edit(id)}
      >
        <Pencil size={17} aria-hidden="true" />
      </button>
    </article>
  );
});
export const PageNode = memo(function PageNode({
  id,
  data,
}: NodeProps<BlockNode>) {
  const actions = useContext(FlowActions);
  return (
    <div className="flow-page-label">
      <Handle type="target" position={Position.Left} />
      <Handle
        type="source"
        id="default"
        position={Position.Right}
        isConnectable={!data.readOnly}
      />
      <button className="nodrag" onClick={() => actions.target(id)}>
        {data.title} · Continue evaluates page routing
      </button>
      <button className="nodrag" onClick={() => actions.edit(id)}>
        Rules
      </button>
      <button
        className="nodrag"
        disabled={data.readOnly}
        onClick={() => actions.port(id, "default")}
      >
        Connect Continue
      </button>
    </div>
  );
});
