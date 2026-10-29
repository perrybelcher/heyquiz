"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Flag, GitBranch, GripVertical, LayoutList, Plus, Settings2, Users, FileText } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { FormSchemaType, QuestionType } from "@/lib/schema";
import V2ElementPicker, { type V2PaletteSection } from "./V2ElementPicker";
import { outlineDropTarget } from "./editor-order";
import "./editor.css";

export interface V2EditorLayoutProps {
  form: FormSchemaType;
  selectedQuestionId: string | null;
  activePageId: string;
  canvasView: "page" | "cover" | "ending";
  onSelectQuestion: (id: string) => void;
  onSelectPage: (id: string) => void;
  onSelectView: (view: "page" | "cover" | "ending") => void;
  onAddElement: (type: QuestionType, insertIndex?: number) => void;
  onMoveQuestion: (id: string, direction: -1 | 1) => void;
  onReorderQuestion?: (id: string, beforeId: string | null, targetPageId: string) => void;
  paletteSections: V2PaletteSection[];
  canvas: ReactNode;
  inspector: ReactNode;
  toolbar?: ReactNode;
  onAddPage?: () => void;
  onLogic?: () => void;
  onLeadCapture?: () => void;
}

function OutlineItem({ id, label, sortable, children }: { id: string; label: string; sortable: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !sortable });
  return <div ref={setNodeRef} className={`v2-editor-flow-item${isDragging ? " is-dragging" : ""}`} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}>
    {sortable && <button type="button" className="v2-editor-outline-drag" {...attributes} {...listeners} aria-label={`Reorder ${label}`}><GripVertical size={14} /></button>}{children}
  </div>;
}

export default function V2EditorLayout(props: V2EditorLayoutProps) {
  const [panel, setPanel] = useState<"flow" | "edit" | "settings">("edit");
  const [insertion, setInsertion] = useState<{ index?: number; label: string } | null>(null);
  const canvas = useRef<HTMLElement>(null), focusNew = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const pages = props.form.pages?.length ? props.form.pages : [{ id: "page-1", title: "Page 1", questionIds: [] }];
  const outlineQuestions = pages.flatMap(page => props.form.questions.filter(question => (question.pageId || pages[0].id) === page.id));
  const selectedIndex = props.form.questions.findIndex(question => question.id === props.selectedQuestionId);
  const palette = props.paletteSections.flatMap(section => section.items);
  useEffect(() => {
    if (!focusNew.current) return;
    focusNew.current = false;
    const frame = requestAnimationFrame(() => canvas.current?.querySelector<HTMLElement>('[data-v2-question] textarea, [data-v2-question] input:not([type="hidden"]), [data-v2-question] [contenteditable="true"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [props.selectedQuestionId]);
  function openPicker(index = selectedIndex >= 0 ? selectedIndex + 1 : undefined) {
    const previous = index !== undefined ? props.form.questions[index - 1] : undefined;
    setInsertion({ index, label: previous ? `Insert after question ${index} · ${previous.title || "Untitled question"}` : `Add to ${pages.find(page => page.id === props.activePageId)?.title || "current page"}` });
  }
  function reorder(activeId: string, overId: string) {
    const target = outlineDropTarget(props.form.questions, outlineQuestions.map(question => question.id), activeId, overId, pages[0].id);
    if (target) props.onReorderQuestion?.(activeId, target.beforeId, target.targetPageId);
  }
  return <div className="v2-editor-layout" data-mobile-panel={panel}>
    <nav className="v2-editor-mobile-panels" aria-label="Editor panels">{([{ id: "flow", label: "Flow", icon: LayoutList }, { id: "edit", label: "Edit", icon: FileText }, { id: "settings", label: "Settings", icon: Settings2 }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={panel === id} onClick={() => setPanel(id)}><Icon size={17} />{label}</button>)}</nav>
    <aside className="v2-editor-outline" aria-label="Quiz flow">
      <div className="v2-editor-outline-heading"><h2>Quiz flow</h2><button type="button" className="v2-editor-button is-primary" onClick={() => openPicker()}><Plus size={18} />Add element</button></div>
      <div className="v2-editor-outline-scroll">
        <button type="button" className="v2-editor-flow-special" aria-current={props.canvasView === "cover" ? "step" : undefined} onClick={() => { props.onSelectView("cover"); setPanel("edit"); }}><FileText size={20} /><span><strong>Welcome</strong><small>Introduction</small></span></button>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id || !props.onReorderQuestion) return;
          reorder(String(active.id), String(over.id));
        }}><SortableContext items={outlineQuestions.map(question => question.id)} strategy={verticalListSortingStrategy}>
        {pages.map(page => <section key={page.id} className="v2-editor-page-group" aria-label={page.title}>
          {pages.length > 1 && <button type="button" className="v2-editor-page-label" aria-pressed={props.activePageId === page.id && props.canvasView === "page"} onClick={() => { props.onSelectPage(page.id); props.onSelectView("page"); setPanel("edit"); }}>{page.title}</button>}
          {props.form.questions.filter(question => (question.pageId || pages[0].id) === page.id).map((question, pageIndex, pageQuestions) => {
            const index = props.form.questions.findIndex(item => item.id === question.id), selected = props.selectedQuestionId === question.id && props.canvasView === "page";
            return <OutlineItem key={question.id} id={question.id} label={question.title || "Untitled question"} sortable={!!props.onReorderQuestion}>
              <button type="button" className="v2-editor-question-link" aria-current={selected ? "step" : undefined} onClick={() => { props.onSelectPage(page.id); props.onSelectQuestion(question.id); props.onSelectView("page"); setPanel("edit"); }}>
                <span className="v2-editor-question-number">{index + 1}</span><span><strong>{question.title || "Untitled question"}</strong><small>{palette.find(item => item.type === question.type)?.label || question.type.replaceAll("_", " ")}</small></span>
              </button>
              {selected && <><div className="v2-editor-reorder" aria-label="Reorder selected question"><button type="button" disabled={pageIndex === 0} aria-label="Move selected question up" onClick={() => props.onReorderQuestion ? reorder(question.id, pageQuestions[pageIndex - 1].id) : props.onMoveQuestion(question.id, -1)}><ArrowUp size={14} />Move up</button><button type="button" disabled={pageIndex === pageQuestions.length - 1} aria-label="Move selected question down" onClick={() => props.onReorderQuestion ? reorder(question.id, pageQuestions[pageIndex + 1].id) : props.onMoveQuestion(question.id, 1)}><ArrowDown size={14} />Move down</button></div><button type="button" className="v2-editor-insert" onClick={() => openPicker(index + 1)}><Plus size={16} />Insert here</button></>}
            </OutlineItem>;
          })}
        </section>)}</SortableContext></DndContext>
        {props.onAddPage && <button type="button" className="v2-editor-add-page" onClick={props.onAddPage}><Plus size={15} />Add page</button>}
        {props.onLeadCapture && <button type="button" className="v2-editor-flow-special" onClick={() => { props.onLeadCapture?.(); setPanel("edit"); }}><Users size={20} /><span><strong>Lead capture</strong><small>Collect contact information</small></span></button>}
        <button type="button" className="v2-editor-flow-special" aria-current={props.canvasView === "ending" ? "step" : undefined} onClick={() => { props.onSelectView("ending"); setPanel("edit"); }}><Flag size={20} /><span><strong>Results & endings</strong><small>Results and next steps</small></span></button>
      </div>
    </aside>
    <main ref={canvas} className="v2-editor-canvas" aria-label="Quiz editing canvas">
      <div className="v2-editor-canvas-toolbar"><span>{props.canvasView === "page" ? selectedIndex >= 0 ? `Question ${selectedIndex + 1} of ${props.form.questions.length}` : "Add your first element" : props.canvasView === "cover" ? "Welcome screen" : "Results & endings"}</span>{props.toolbar}</div>
      <div className="v2-editor-canvas-content">{props.canvas}</div>
    </main>
    <aside className="v2-editor-inspector" aria-label="Element settings"><div className="v2-editor-inspector-heading"><h2>Settings</h2>{props.onLogic && <button type="button" onClick={props.onLogic}><GitBranch size={16} />Logic</button>}</div>{props.inspector}</aside>
    {insertion && <V2ElementPicker sections={props.paletteSections} location={insertion.label} onClose={() => setInsertion(null)} onSelect={type => { focusNew.current = true; props.onAddElement(type, insertion.index); setInsertion(null); setPanel("edit"); }} />}
  </div>;
}
