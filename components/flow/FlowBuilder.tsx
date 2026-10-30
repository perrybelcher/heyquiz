"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Controls,
  Panel,
  useReactFlow,
  useViewport,
  useNodesInitialized,
  applyNodeChanges,
  MarkerType,
  type Edge,
  type Connection,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  Search,
  X,
  Undo2,
  Redo2,
  Play,
  LayoutGrid,
  ArrowLeft,
} from "lucide-react";
import { nanoid } from "nanoid";
import { FormSchema } from "@/lib/schema";
import type { FormSchemaType, Question, QuestionType } from "@/lib/schema";
import { orderedQuestions, singleTypes, resolvePath } from "@/lib/engine";
import {
  migrateLegacyRouting,
  validateFlowRouting,
  type FlowDestination,
} from "@/lib/flow-routing";
import {
  reconcileFlowEdit,
  appendFlowQuestion,
  automatic,
  connectAnswer,
  destinationChoices,
  destinationKey,
  parseDestination,
  removeQuestion,
  routeOwner,
  updateRoute,
} from "@/lib/flow-editing";
import {
  FlowActions,
  QuestionNode,
  ResultNode,
  PageNode,
  type BlockNode,
} from "./FlowNodes";
import FlowInspector from "./FlowInspector";
import FlowBranchChooser from "./FlowBranchChooser";
import { simulateJourneys } from "@/lib/journey-testing";
import {
  parseJourneyFixtures,
  journeyFixtureStorageKey,
  runJourneyFixture,
  expectationFor,
} from "@/lib/journey-fixtures";
import "./flow.css";
const nodeTypes = {
  question: QuestionNode,
  result: ResultNode,
  page: PageNode,
};
type Props = {
  form: FormSchemaType;
  onChange: (form: FormSchemaType) => void;
  onPreview: () => void;
  onClose: () => void;
};
export default function FlowBuilder(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas key={props.form.id} {...props} />
    </ReactFlowProvider>
  );
}
function ZoomLabel() {
  const { zoom } = useViewport();
  return <span>{Math.round(zoom * 100)}%</span>;
}
const fitOptions = {
  padding: {
    top: "90px" as const,
    bottom: "140px" as const,
    left: "60px" as const,
    right: "60px" as const,
  },
  minZoom: 0.02,
  maxZoom: 1.2,
};
function Canvas({ form, onChange, onPreview, onClose }: Props) {
  const rf = useReactFlow(),
    initialized = useNodesInitialized();
  const initialFit = useRef(false),
    userNavigated = useRef(false);
  const [editing, setEditing] = useState<string | null>(null),
    [port, setPort] = useState<{ id: string; handle: string } | null>(null),
    [selection, setSelection] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [notice, setNotice] = useState(""),
    [review, setReview] = useState(false),
    [history, setHistory] = useState<FormSchemaType[]>([]),
    [future, setFuture] = useState<FormSchemaType[]>([]),
    [nodes, setNodes] = useState<BlockNode[]>([]),
    [branch, setBranch] = useState<{ source: string; handle: string; edgeId?: string; insert?: boolean; position?: {x: number; y: number} } | null>(null);
  const connectionSource = useRef<{source: string; handle: string} | null>(null);
  const current = useRef(form);
  useLayoutEffect(() => {
    current.current = form;
  }, [form]);
  const expected = useRef(form),
    worker = useRef<Worker | null>(null),
    layoutId = useRef(0),
    layoutStarted = useRef(false),
    dialog = useRef<HTMLDialogElement>(null);
  const [savedViewport] = useState(() => {
    try {
      const raw = localStorage.getItem(`pippi-flow-viewport:${form.id}`);
      if (!raw) return undefined;
      const p = JSON.parse(raw);
      return [p.x, p.y, p.zoom].every(Number.isFinite) &&
        p.zoom >= 0.02 &&
        p.zoom <= 2
        ? p
        : undefined;
    } catch {
      return undefined;
    }
  });
  const readOnly = !form.routing;
  const migrated = useMemo(() => migrateLegacyRouting(form), [form]);
  const view = form.routing ? form : migrated.form;
  const commit = useCallback(
    (next: FormSchemaType) => {
      next = reconcileFlowEdit(current.current, next);
      try {
        validateFlowRouting(next);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Invalid flow edit");
        return false;
      }
      layoutId.current++;
      setHistory((h) => [...h.slice(-99), current.current]);
      setFuture([]);
      expected.current = next;
      onChange(next);
      return true;
    },
    [onChange],
  );
  useEffect(() => {
    if (form !== expected.current) {
      setHistory([]);
      setFuture([]);
      layoutId.current++;
    }
    expected.current = form;
  }, [form]);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const element = dialog.current;
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);
  useEffect(() => () => worker.current?.terminate(), []);
  const keyToNode = (d: FlowDestination) =>
    d.kind === "automatic"
      ? "automatic"
      : d.kind === "question"
        ? d.id
        : `${d.kind}:${d.id}`;
  const edges = useMemo(() => {
    const result: Edge[] = [];
    for (const [owner, route] of Object.entries(view.routing?.routes || {})) {
      for (const rule of route.rules) {
        const c = rule.conditions[0],
          q = view.questions.find((q) => q.id === c?.questionId),
          exact =
            rule.conditions.length === 1 &&
            c?.operator === "equals" &&
            q?.options?.some((o) => o.id === c.value);
        const source = exact ? c.questionId : owner;
        result.push({
          id: `${owner}:${rule.id}`,
          data: { owner, ruleId: rule.id, isDefault: false },
          source:
            view.settings.presentation === "page" && !exact
              ? `page:${owner}`
              : source,
          sourceHandle: exact ? c.value : "default",
          target: keyToNode(rule.destination),
          label: exact
            ? undefined
            : `${rule.match === "all" ? "All" : "Any"} ${rule.conditions.length} conditions`,
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
      if (route.default)
        result.push({
          id: `default:${owner}`,
          data: { owner, isDefault: true },
          source:
            view.settings.presentation === "page" ? `page:${owner}` : owner,
          sourceHandle:
            view.settings.presentation === "page" ? undefined : "default",
          target: keyToNode(route.default),
          label: "Otherwise",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeDasharray: "5 4" },
        });
    }
    return result;
  }, [view]);
  const projected = useMemo(() => {
    const labels = new Map(destinationChoices(view).map(c => [c.value, c.label]));
    // Keep first-match rule priority when several rules mention the same answer.
    const exactEdges = new Map<string, Edge>();
    for (const edge of edges) {
      if (edge.data?.isDefault || !edge.sourceHandle || edge.sourceHandle === "default") continue;
      const key = `${edge.source}\0${edge.sourceHandle}`;
      if (!exactEdges.has(key)) exactEdges.set(key, edge);
    }
    const answerData = (questionId: string, handle: string, label: string) => {
      const owner = routeOwner(view, questionId);
      const route = view.routing?.routes[owner];
      const exact = handle === "default" ? undefined : exactEdges.get(`${questionId}\0${handle}`);
      const exactIndex = exact ? route?.rules.findIndex(r => r.id === exact.data?.ruleId) ?? -1 : -1;
      const precedingRules = exactIndex >= 0 ? route!.rules.slice(0, exactIndex) : route?.rules || [];
      const conditional = precedingRules.some(rule => {
        const condition = rule.conditions[0];
        // An exact match on another answer of this question cannot preempt this port.
        return !(handle !== "default" && rule.conditions.length === 1 && condition.questionId === questionId && condition.operator === "equals" && condition.value !== handle && view.questions.find(q => q.id === questionId)?.options?.some(o => o.id === condition.value));
      });
      const destination = exact ? route?.rules[exactIndex]?.destination : route?.default;
      const id = destination ? keyToNode(destination) : undefined;
      const resolvedLabel = destination ? labels.get(destinationKey(destination)) : undefined;
      const destinationLabel = resolvedLabel ? `${conditional ? "After conditions: " : ""}${resolvedLabel}` : undefined;
      return { id: handle, label, destinationId: id, destinationLabel,
        inherited: handle !== "default" && !exact && !!destination };
    };
    const positions = form.editorLayout?.positions || {},
      grouped = view.settings.presentation === "page" && !!view.pages?.length;
    const items: BlockNode[] = [];
    if (grouped)
      for (const [i, p] of (view.pages || []).entries()) {
        const children = view.questions.filter(
          (q) => (q.pageId || view.pages?.[0]?.id) === p.id,
        );
        items.push({
          id: `page:${p.id}`,
          type: "page",
          position: positions[`page:${p.id}`] || { x: i * 480, y: 60 },
          style: {
            width: 370,
            height:
              80 +
              children.reduce(
                (n, q) => n + 150 + ((q.options?.length || 0) + 1) * 75,
                0,
              ),
            background: "#eeeee780",
            border: "1px solid #d7d7cd",
            borderRadius: 12,
          },
          data: { title: p.title, label: "Page", answers: [], readOnly },
        });
      }
    for (const [i, q] of orderedQuestions(view).entries()) {
      const siblings = grouped
        ? view.questions.filter(
            (n) =>
              (n.pageId || view.pages?.[0]?.id) ===
              (q.pageId || view.pages?.[0]?.id),
          )
        : [];
      const y = grouped
        ? siblings
            .slice(
              0,
              siblings.findIndex((n) => n.id === q.id),
            )
            .reduce((n, q) => n + 150 + ((q.options?.length || 0) + 1) * 75, 55)
        : (i % 3) * 620;
      items.push({
        id: q.id,
        type: "question",
        parentId: grouped
          ? `page:${q.pageId || view.pages?.[0]?.id}`
          : undefined,
        extent: grouped ? "parent" : undefined,
        dragHandle: ".flow-node-grip",
        position: positions[q.id] || {
          x: grouped ? 25 : Math.floor(i / 3) * 460,
          y,
        },
        data: {
          title: q.title,
          label: `${i + 1} · ${q.type.replaceAll("_", " ")}`,
          answers: [
            ...(singleTypes.has(q.type)
              ? (q.options || []).map((o) => answerData(q.id, o.id, o.label))
              : []),
            answerData(q.id, "default", "Otherwise / Continue"),
          ],
          readOnly,
          activePort: port?.id === q.id ? port.handle : undefined,
        },
      });
    }
    for (const [i, d] of destinationChoices(view)
      .filter(
        (d) =>
          d.value === "automatic" ||
          d.value.startsWith("outcome:") ||
          d.value.startsWith("tier:"),
      )
      .entries())
      items.push({
        id: d.value,
        type: "result",
        dragHandle: ".flow-node-grip",
        position: positions[d.value] || {
          x: Math.ceil(view.questions.length / 3) * 460,
          y: i * 180,
        },
        data: {
          title: d.label,
          label: d.value === "automatic" ? "CALCULATED RESULT" : "RESULT PAGE",
          answers: [],
          readOnly,
        },
      });
    return items;
  }, [form.editorLayout, view, readOnly, port, edges]);
  useEffect(() => {
    // React Flow owns transient drag positions; external draft changes replace that local projection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(projected);
  }, [projected]);
  const arrange = useCallback(
    (initial = false) => {
      if (readOnly && initial) return;
      worker.current?.terminate();
      const requestId = ++layoutId.current;
      worker.current = new Worker(
        new URL("./layout.worker.ts", import.meta.url),
      );
      worker.current.onerror = () =>
        setNotice(
          "Automatic layout is unavailable. You can continue arranging questions manually.",
        );
      worker.current.onmessage = (e) => {
        if (e.data.requestId !== layoutId.current) return;
        if (initial && userNavigated.current) return;
        if (e.data.error) {
          setNotice(e.data.error);
          return;
        }
        const positions = e.data.positions as Record<
          string,
          { x: number; y: number }
        >;
        const next = {
          ...current.current,
          editorLayout: {
            version: 1 as const,
            positions: {
              ...current.current.editorLayout?.positions,
              ...positions,
            },
          },
        };
        if (initial) {
          expected.current = next;
          onChange(next);
        } else commit(next);
        requestAnimationFrame(
          () =>
            (!initial || !userNavigated.current) &&
            rf.fitView({ ...fitOptions, duration: 200 }),
        );
      };
      const top = nodes.filter((n) => !n.parentId);
      worker.current.postMessage({
        requestId,
        nodes: top.map((n) => ({
          id: n.id,
          width: Number(n.style?.width) || 320,
          height:
            Number(n.style?.height) ||
            (n.type === "question" ? 150 + n.data.answers.length * 75 : 100),
        })),
        edges: edges.filter(
          (e) =>
            top.some((n) => n.id === e.source) &&
            top.some((n) => n.id === e.target),
        ),
      });
    },
    [readOnly, nodes, edges, commit, onChange, rf],
  );
  useEffect(() => {
    if (
      !layoutStarted.current &&
      nodes.length &&
      form.routing &&
      !Object.keys(form.editorLayout?.positions || {}).length
    ) {
      layoutStarted.current = true;
      arrange(true);
    }
  }, [nodes, form.routing, form.editorLayout, arrange]);
  const connect = useCallback(
    (id: string, handle: string, destination: FlowDestination) => {
      if (readOnly) {
        setNotice("Upgrade this draft to edit connections.");
        return;
      }
      const owner = id.startsWith("page:") ? id.slice(5) : routeOwner(form, id);
      const route = form.routing!.routes[owner] || { rules: [] };
      const next =
        handle === "default"
          ? updateRoute(form, owner, { ...route, default: destination })
          : connectAnswer(form, id, handle, destination);
      try {
        validateFlowRouting(next);
        commit(next);
        setPort(null);
        setNotice("Connection updated");
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "Invalid connection",
        );
      }
    },
    [form, readOnly, commit],
  );
  const target = useCallback(
    (id: string) => {
      if (!port) {
        setEditing(id);
        return;
      }
      connect(
        port.id,
        port.handle,
        id === "automatic"
          ? automatic
          : id.includes(":")
            ? parseDestination(id)
            : { kind: "question", id },
      );
    },
    [port, connect],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target)
        connect(
          c.source,
          c.sourceHandle || "default",
          c.target === "automatic"
            ? automatic
            : c.target.includes(":")
              ? parseDestination(c.target)
              : { kind: "question", id: c.target },
        );
    },
    [connect],
  );
  const upgrade = () => {
    if (migrated.issues.length) return;
    try {
      const journeys = simulateJourneys(form, 256);
      for (const journey of journeys.cases) {
        const before = resolvePath(form, journey.answers),
          after = resolvePath(migrated.form, journey.answers);
        if (
          JSON.stringify(before.questions.map((q) => q.id)) !==
            JSON.stringify(after.questions.map((q) => q.id)) ||
          before.tierId !== after.tierId
        )
          throw new Error(
            "A sampled journey changed during conversion. Review existing rules before upgrading.",
          );
      }
      const fixtures = parseJourneyFixtures(
        localStorage.getItem(journeyFixtureStorageKey(form.id)),
        form.id,
      );
      for (const fixture of fixtures) {
        const before = runJourneyFixture(form, fixture),
          after = runJourneyFixture(migrated.form, fixture);
        if (
          JSON.stringify(expectationFor(before.actual)) !==
          JSON.stringify(expectationFor(after.actual))
        )
          throw new Error(
            `Saved journey “${fixture.name}” changes during conversion. Review its routing before upgrading.`,
          );
      }
      localStorage.setItem(
        `pippi-flow-backup:${form.id}`,
        JSON.stringify(form),
      );
      commit(migrated.form);
      setReview(false);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not preserve the previous draft. Free browser storage before upgrading.",
      );
    }
  };
  const undo = () => {
    setEditing(null);
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((f) => [...f, current.current]);
    setHistory((h) => h.slice(0, -1));
    const next = { ...previous, revision: form.revision };
    expected.current = next;
    onChange(next);
  };
  const redo = () => {
    setEditing(null);
    const next = future.at(-1);
    if (!next) return;
    setHistory((h) => [...h, current.current]);
    setFuture((f) => f.slice(0, -1));
    const restored = { ...next, revision: form.revision };
    expected.current = restored;
    onChange(restored);
  };
  const goTo = useCallback((id: string) => {
    userNavigated.current = true;
    const node = rf.getInternalNode(id);
    if (!node) return;
    const absolute = node.internals.positionAbsolute;
    void rf.setCenter(absolute.x + (node.measured.width || 320) / 2,
      absolute.y + (node.measured.height || 200) / 2,
      { zoom: Math.max(rf.getZoom(), 0.65), duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180 });
  }, [rf]);
  const openBranch = useCallback((source: string, handle: string, edgeId?: string, position?: {x: number; y: number}) => {
    if (readOnly) return;
    setEditing(null);
    setNotice("");
    setPort({ id: source, handle });
    setBranch({ source, handle, edgeId, position });
  }, [readOnly]);
  // Rewrite one existing rule in place, preserving ordered condition priority.
  const routeBranch = (draft: FormSchemaType, context: NonNullable<typeof branch>, destination: FlowDestination) => {
    const edge = context.edgeId ? edges.find(e => e.id === context.edgeId) : edges.find(e => context.handle !== "default" && e.source === context.source && e.sourceHandle === context.handle && !e.data?.isDefault);
    const owner = edge ? String(edge.data?.owner) : context.source.startsWith("page:") ? context.source.slice(5) : routeOwner(draft, context.source);
    const route = draft.routing!.routes[owner] || { rules: [] };
    if (edge && !edge.data?.isDefault)
      return updateRoute(draft, owner, { ...route, rules: route.rules.map(r => r.id === edge.data?.ruleId ? {...r, destination} : r) });
    return context.handle === "default" ? updateRoute(draft, owner, { ...route, default: destination }) : connectAnswer(draft, context.source, context.handle, destination);
  };
  const nearbyPosition = (context: typeof branch) => {
    if (context?.position) return context.position;
    const source = context && rf.getInternalNode(context.source);
    const origin = source ? { x: source.internals.positionAbsolute.x + (source.measured.width || 320) + 130, y: source.internals.positionAbsolute.y } : rf.screenToFlowPosition({x: window.innerWidth * 0.35, y: window.innerHeight * 0.35});
    let position = origin;
    const topNodes = rf.getNodes().filter(n => !n.parentId);
    // Only the new block moves; existing positions are never rearranged.
    for (let i = 0; i < 210; i++) {
      const collides = topNodes.some(n => position.x < n.position.x + (n.measured?.width || 370) + 24 && position.x + 370 + 24 > n.position.x && position.y < n.position.y + (n.measured?.height || 320) + 24 && position.y + 440 + 24 > n.position.y);
      if (!collides) break;
      position = { x: origin.x, y: position.y + 120 };
    }
    return position;
  };
  const finishCreation = (next: FormSchemaType, id: string) => {
    if (!commit(next)) return;
    setBranch(null); setPort(null); setSelection(null); setEditing(id);
    setNotice(`${id.includes(":") ? "Result" : "Question"} added${branch ? " and connected" : ""}. Edit it in the panel.`);
    // Wait for React Flow to measure the new block before revealing it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const node = rf.getInternalNode(id);
      if (!node) return;
      const position = node.internals.positionAbsolute;
      const screen = rf.flowToScreenPosition(position);
      const canvas = dialog.current?.querySelector(".flow-canvas")?.getBoundingClientRect();
      if (canvas && (screen.x < canvas.left + 24 || screen.x + 320 > canvas.right - 24 || screen.y < canvas.top + 70 || screen.y + 240 > canvas.bottom - 130)) goTo(id);
    }));
  };
  const add = (result = false, type: QuestionType = "multiple_choice", context: typeof branch = null) => {
    if (readOnly || (!result && form.questions.length >= 200)) return;
    const id = nanoid(12), position = nearbyPosition(context);
    if (result) {
      let next = form;
      let destination: FlowDestination;
      if (form.marketing && form.marketing.kind !== "scorecard" && form.quizType !== "knowledge") {
        destination = {kind: "outcome", id};
        next = {...form, marketing: {...form.marketing, outcomes: [...form.marketing.outcomes, {id, title: "New result", description: "", advice: "", ctaLabel: "", ctaUrl: "", minPoints: 1}]}};
      } else if (!form.marketing && !["knowledge", "scorecard"].includes(form.quizType || "")) {
        destination = {kind: "tier", id};
        next = {...form, outcomeTiers: [...form.outcomeTiers, {id, title: "New ending", message: "", badge: "", minScorePercent: 0, maxScorePercent: 100}]};
      } else { setNotice("This quiz calculates its results. Edit its existing endings in Results."); return; }
      if (context) next = routeBranch(next, context, destination);
      const key = keyToNode(destination);
      next = {...next, editorLayout: {version: 1, positions: {...form.editorLayout?.positions, [key]: position}}};
      finishCreation(next, key);
      return;
    }
    const grouped = form.settings.presentation === "page";
    // A branch enters a page on Continue. A fresh page prevents implying mid-page navigation.
    const pageId = grouped && context ? nanoid(12) : grouped ? form.pages?.[0]?.id : undefined;
    const q: Question = {id, type, title: "New question", options: ["multiple_choice", "multiselect"].includes(type) ? [{id: nanoid(10), label: "Answer A"}, {id: nanoid(10), label: "Answer B"}] : undefined, pageId};
    let next = grouped && context ? {...form, pages: [...(form.pages || []), {id: pageId!, title: `Page ${(form.pages?.length || 0) + 1}`, questionIds: [id]}]} : form;
    next = appendFlowQuestion(next, q);
    const owner = routeOwner(next, id);
    if (grouped) next = {...next, pages: next.pages?.map(p => p.id === owner ? {...p, questionIds: [...new Set([...p.questionIds, id])]} : p)};
    const insertedEdge = context?.edgeId ? edges.find(e => e.id === context.edgeId) : undefined;
    const oldRoute = insertedEdge ? form.routing!.routes[String(insertedEdge.data?.owner)] : undefined;
    const continuation = context?.insert && insertedEdge?.data?.isDefault ? oldRoute?.default : context?.insert ? oldRoute?.rules.find(r => r.id === insertedEdge?.data?.ruleId)?.destination : undefined;
    if (!grouped || context || !next.routing?.routes[owner]) next = updateRoute(next, owner, {rules: [], default: continuation || automatic});
    if (context) next = routeBranch(next, context, grouped ? {kind: "page", id: owner} : {kind: "question", id});
    next = {...next, editorLayout: {version: 1, positions: {...form.editorLayout?.positions, ...(grouped ? {[`page:${owner}`]: context ? position : form.editorLayout?.positions[`page:${owner}`] || {x: 0, y: 60}, [id]: {x: 25, y: context ? 55 : form.questions.filter(n => (n.pageId || form.pages?.[0]?.id) === owner).reduce((y, n) => y + 150 + ((n.options?.length || 0) + 1) * 75, 55)}} : {[id]: position})}}};
    finishCreation(next, id);
  };
  useEffect(() => {
    if (
      !initialized ||
      !nodes.length ||
      nodes.length !== projected.length ||
      initialFit.current
    )
      return;
    if (savedViewport || userNavigated.current) {
      initialFit.current = true;
      return;
    }
    const frame = requestAnimationFrame(() => {
      initialFit.current = true;
      if (!userNavigated.current) void rf.fitView(fitOptions);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialized, nodes.length, projected.length, savedViewport, rf]);
  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        selected: e.id === selection,
        style: {
          ...e.style,
          stroke: e.id === selection ? "#a92335" : "#69717a",
          strokeWidth: 2,
        },
      })),
    [edges, selection],
  );
  const actions = useMemo(
    () => ({
      edit: target,
      port: (id: string, handle: string) => {
        setPort({ id, handle });
        setNotice("Tap a destination block, or choose it in the editor.");
        setEditing(id);
      },
      target,
      choose: openBranch,
      goTo,
    }),
    [target, openBranch, goTo],
  );
  const chosen = edges.find((e) => e.id === selection);
  const renderedNodes = useMemo(() => {
    const edge = edges.find((e) => e.id === selection);
    if (!edge) return nodes;
    return nodes.map((n) =>
      n.id === edge.source
        ? {
            ...n,
            selected: true,
            data: { ...n.data, activePort: edge.sourceHandle || "default" },
          }
        : n.id === edge.target
          ? { ...n, selected: true }
          : n,
    );
  }, [edges, nodes, selection]);
  return (
    <dialog
      ref={dialog}
      className="flow-dialog"
      onCancel={(event) => {
        if (branch) {
          event.preventDefault(); setBranch(null); setPort(null);
        } else if (editing) {
          event.preventDefault();
          setEditing(null);
        } else onClose();
      }}
    >
      <div
        className="flow-shell"
        onKeyDown={(event) => {
          if (
            !(event.metaKey || event.ctrlKey) ||
            event.key.toLowerCase() !== "z"
          )
            return;
          const target = event.target as HTMLElement;
          if (target.closest("input,textarea,select,[contenteditable]")) return;
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }}
      >
        <header className="flow-header">
          <button onClick={onClose}>
            <ArrowLeft size={18} />
            Builder
          </button>
          <div>
            <h1>{form.title}</h1>
            <span>Flow <strong className="flow-beta-badge">Beta</strong> · {form.questions.length} questions</span>
          </div>
          <button onClick={onPreview}>
            <Play size={17} />
            Test quiz
          </button>
        </header>
        <p className="flow-beta-notice">Flow builder is in beta. Test each path before publishing.</p>
        {readOnly && (
          <div className="flow-legacy">
            Existing quiz · reviewing this map does not change its routing.
            <button onClick={() => setReview(true)}>Upgrade routing</button>
          </div>
        )}
        {form.routing && (
          <div className="flow-recovery">
            <button
              onClick={() => {
                try {
                  const raw = localStorage.getItem(
                    `pippi-flow-backup:${form.id}`,
                  );
                  if (!raw) {
                    setNotice(
                      "No pre-upgrade backup is available on this device.",
                    );
                    return;
                  }
                  const backup = FormSchema.parse(JSON.parse(raw));
                  if (backup.id !== form.id)
                    throw new Error("Backup belongs to another quiz");
                  if (
                    window.confirm(
                      "Restore the entire draft from before the routing upgrade? You can undo this restoration.",
                    )
                  )
                    commit({ ...backup, revision: form.revision });
                } catch (error) {
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : "Could not restore backup",
                  );
                }
              }}
            >
              Restore pre-upgrade draft
            </button>
          </div>
        )}
        <div className="flow-workspace">
          <div className="flow-canvas">
            <FlowActions.Provider value={actions}>
              <ReactFlow
                nodes={renderedNodes}
                edges={styledEdges}
                nodeTypes={nodeTypes}
                onNodesChange={(changes: NodeChange<BlockNode>[]) =>
                  setNodes((ns) => applyNodeChanges(changes, ns))
                }
                onNodeDragStop={(_, n) => {
                  if (!readOnly)
                    commit({
                      ...form,
                      editorLayout: {
                        version: 1,
                        positions: {
                          ...form.editorLayout?.positions,
                          [n.id]: n.position,
                        },
                      },
                    });
                }}
                onConnect={onConnect}
                onConnectStart={(_, params) => { connectionSource.current = params.handleType === "source" && params.nodeId ? {source: params.nodeId, handle: params.handleId || "default"} : null; }}
                onConnectEnd={(event, state) => {
                  const source = connectionSource.current;
                  connectionSource.current = null;
                  if (!source || state.isValid || state.toNode) return;
                  const point = "changedTouches" in event ? event.changedTouches[0] : event;
                  if (!point || !(event.target instanceof Element) || !event.target.closest(".react-flow__pane")) return;
                  openBranch(source.source, source.handle, undefined, rf.screenToFlowPosition({x: point.clientX, y: point.clientY}));
                }}
                onNodeDoubleClick={(_, n) => setEditing(n.id)}
                onEdgeClick={(_, e) => {
                  setSelection(e.id);
                  setEditing(null);
                }}
                onPaneClick={() => {
                  setSelection(null);
                  setPort(null);
                }}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                deleteKeyCode={null}
                defaultViewport={savedViewport}
                fitView={false}
                onMoveStart={(event) => {
                  if (event) userNavigated.current = true;
                }}
                onMoveEnd={(_, viewport) => {
                  try {
                    localStorage.setItem(
                      `pippi-flow-viewport:${form.id}`,
                      JSON.stringify(viewport),
                    );
                  } catch {
                    /* View remains usable without browser storage. */
                  }
                }}
                fitViewOptions={fitOptions}
                minZoom={0.02}
                maxZoom={2}
                connectionRadius={35}
              >
                <Background gap={24} size={1} />
                <MiniMap pannable zoomable />
                <Controls showInteractive={false} fitViewOptions={fitOptions} />
                <Panel position="top-left">
                  <div className="flow-tools">
                    <button
                      disabled={readOnly || form.questions.length >= 200}
                      onClick={() => add()}
                    >
                      <Plus size={18} />
                      Add question
                    </button>
                    <button disabled={readOnly} onClick={() => add(true)}>
                      <Plus size={18} />
                      Add result
                    </button>
                    <label className="flow-search">
                      <Search size={17} />
                      <select
                        aria-label="Find question"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          userNavigated.current = true;
                          const node = rf.getInternalNode(e.target.value);
                          if (node) {
                            const absolute = node.internals.positionAbsolute;
                            void rf.setCenter(
                              absolute.x + (node.measured.width || 320) / 2,
                              absolute.y + (node.measured.height || 200) / 2,
                              { zoom: 0.9, duration: 200 },
                            );
                          }
                        }}
                      >
                        <option value="">Find question</option>
                        {form.questions.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </Panel>
                <Panel position="bottom-center">
                  <div className="flow-tools">
                    <button
                      aria-label="Undo"
                      disabled={!history.length}
                      onClick={undo}
                    >
                      <Undo2 size={18} />
                    </button>
                    <button
                      aria-label="Redo"
                      disabled={!future.length}
                      onClick={redo}
                    >
                      <Redo2 size={18} />
                    </button>
                    <ZoomLabel />
                    <button disabled={readOnly} onClick={() => arrange()}>
                      <LayoutGrid size={17} />
                      Tidy up
                    </button>
                  </div>
                </Panel>
              </ReactFlow>
            </FlowActions.Provider>
            {chosen && (
              <div className="flow-connection-actions">
                <span>
                  {chosen.label || "Answer"} →{" "}
                  {nodes.find((n) => n.id === chosen.target)?.data.title}
                </span>
                <button onClick={() => goTo(chosen.target)}>Go to question</button>
                <button disabled={readOnly} onClick={() => openBranch(chosen.source, chosen.sourceHandle || "default", chosen.id)}>Change destination</button>
                <button disabled={readOnly || form.questions.length >= 200} onClick={() => { setEditing(null); setPort(null); setBranch({source: chosen.source, handle: chosen.sourceHandle || "default", edgeId: chosen.id, insert: true}); }}>+ Insert question</button>
                <button
                  disabled={readOnly}
                  onClick={() => {
                    const owner = String(chosen.data?.owner),
                      r = form.routing!.routes[owner];
                    commit(
                      updateRoute(form, owner, {
                        ...r,
                        rules: r.rules.filter(
                          (rule) => rule.id !== chosen.data?.ruleId,
                        ),
                        default: chosen.data?.isDefault ? undefined : r.default,
                      }),
                    );
                    setSelection(null);
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
          {editing && (
            <FlowInspector
              key={editing}
              form={form}
              id={editing}
              readOnly={readOnly}
              onChange={commit}
              onClose={() => setEditing(null)}
              connect={connect}
              onDelete={() => {
                const deletedId = editing.includes(":")
                  ? editing.slice(editing.indexOf(":") + 1)
                  : editing;
                const references = Object.entries(
                  form.routing?.routes || {},
                ).filter(
                  ([owner, route]) =>
                    owner === deletedId ||
                    route.rules.some(
                      (r) =>
                        r.conditions.some((c) => c.questionId === deletedId) ||
                        (r.destination.kind !== "automatic" &&
                          r.destination.id === deletedId),
                    ) ||
                    (route.default?.kind !== "automatic" &&
                      route.default?.id === deletedId),
                );
                const affected = references
                  .map(
                    ([owner, route]) =>
                      `${form.questions.find((q) => q.id === owner)?.title || form.pages?.find((p) => p.id === owner)?.title || owner} (${route.rules.length} rules)`,
                  )
                  .join(", ");
                const entry = form.routing?.entry;
                const entryWarning =
                  entry && entry.kind !== "automatic" && entry.id === deletedId
                    ? " This is the quiz entry; choose a new entry before publishing."
                    : "";
                if (
                  window.confirm(
                    `Delete this block? Affected route sources: ${affected || "none"}.${entryWarning} Removed destinations remain unconnected for review.`,
                  )
                ) {
                  if (editing.startsWith("outcome:") && form.marketing)
                    commit({
                      ...form,
                      marketing: {
                        ...form.marketing,
                        outcomes: form.marketing.outcomes.filter(
                          (o) => o.id !== editing.slice(8),
                        ),
                      },
                    });
                  else if (editing.startsWith("tier:"))
                    commit({
                      ...form,
                      outcomeTiers: form.outcomeTiers.filter(
                        (t) => t.id !== editing.slice(5),
                      ),
                    });
                  else {
                    try {
                      commit(removeQuestion(form, editing));
                    } catch (error) {
                      setNotice(
                        error instanceof Error
                          ? error.message
                          : "Could not delete question",
                      );
                      return;
                    }
                  }
                  setEditing(null);
                }
              }}
            />
          )}
        </div>
        {branch && <FlowBranchChooser
          title={branch.insert ? "Insert question" : `Continue from ${form.questions.find(q => q.id === branch.source)?.options?.find(o => o.id === branch.handle)?.label || (branch.handle === "default" ? "Continue" : "this answer")}`}
          choices={destinationChoices(form).filter(c => c.value !== `question:${branch.source}` && c.value !== branch.source)}
          error={notice} insert={!!branch.insert} canCreate={form.questions.length < 200}
          canCreateResult={!["knowledge", "scorecard"].includes(form.quizType || "") && form.marketing?.kind !== "scorecard"}
          onQuestion={type => add(false, type, branch)} onResult={() => add(true, "multiple_choice", branch)}
          onDestination={value => { if (commit(routeBranch(form, branch, parseDestination(value)))) {setBranch(null); setPort(null); setSelection(null); setNotice("Connection updated");} }}
          onClose={() => {setBranch(null); setPort(null);}}
        />}
        {notice && (
          <div role="status" className="flow-notice">
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {review && (
          <div className="flow-review">
            <h2>Upgrade draft routing</h2>
            <p>
              A recoverable copy of the previous draft is kept on this device.
              Published quizzes change only when republished.
            </p>
            {migrated.issues.length ? (
              <ul>
                {migrated.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : (
              <p>
                Sequential paths and existing rule priorities will be preserved
                as explicit connections. Review your saved journey cases before
                publishing.
              </p>
            )}
            <button disabled={!!migrated.issues.length} onClick={upgrade}>
              Upgrade draft
            </button>
            <button onClick={() => setReview(false)}>Cancel</button>
          </div>
        )}
      </div>
    </dialog>
  );
}
