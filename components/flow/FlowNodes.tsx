"use client";
import { memo, createContext, useContext, useEffect, useRef } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { GripVertical, Flag, MoreHorizontal } from "lucide-react";
export type BlockData = {
  title: string;
  label: string;
  answers: { id: string; label: string }[];
  readOnly: boolean;
  activePort?: string;
};
export type BlockNode = Node<BlockData>;
export const FlowActions = createContext<{
  edit: (id: string) => void;
  port: (id: string, handle: string) => void;
  target: (id: string) => void;
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
    <article className={`flow-question ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <button
        className="flow-input nodrag"
        aria-label={`Connect to ${data.title}`}
        onClick={() => actions.target(id)}
      />
      <header className="flow-node-heading">
        <GripVertical size={16} />
        <div>
          <small>{data.label}</small>
          <h3>{data.title || "Untitled question"}</h3>
        </div>
        <button
          className="nodrag"
          aria-label={`Edit ${data.title}`}
          onClick={() => actions.edit(id)}
        >
          <MoreHorizontal size={18} />
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
            <span>{a.label}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={a.id}
              isConnectable={!data.readOnly}
            />
            <button
              className="flow-port nodrag"
              disabled={data.readOnly}
              aria-label={`Connect ${a.label}`}
              onClick={() => actions.port(id, a.id)}
            />
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
    <article className={`flow-result ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <button
        className="flow-input nodrag"
        aria-label={`Connect to ${data.title}`}
        onClick={() => actions.target(id)}
      />
      <Flag size={25} />
      <div>
        <small>{data.label}</small>
        <h3>{data.title}</h3>
      </div>
      <button
        aria-label={`Edit ${data.title}`}
        className="nodrag"
        onClick={() => actions.edit(id)}
      >
        <MoreHorizontal size={18} />
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
