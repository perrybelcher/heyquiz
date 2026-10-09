"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import {
  FormSchemaType,
  Question,
  QuestionType,
  OutcomeTier,
  LogicRule,
  LogicOperator,
  LogicAction,
  QuizSubmissionResult,
  FormPage,
  CoverPageConfig,
  EndingPageConfig,
} from "@/lib/schema";
import {
  Search,
  Pencil, Plug,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Check,
  Smartphone,
  Monitor,
  Play,
  Share2,
  Sparkles,
  Code2,
  Sliders,
  Settings,
  ListOrdered,
  Type,
  ToggleLeft,
  Star,
  Layers,
  HelpCircle,
  Clock,
  Trophy,
  ArrowLeft,
  X,
  Paintbrush,
  Bot,
  GitBranch,
  FileText,
  Mail,
  Phone,
  Hash,
  AlignLeft,
  Calendar,
  UploadCloud,
  PenTool,
  Image as ImageIcon,
  CheckSquare,
  Grid,
  Heart,
  SlidersHorizontal,
  FolderPlus,
  Home,
  ChevronDown as ChevronDownIcon,
  Zap,
  Download,
  RefreshCw,
  Users,
  BarChart3,
  ArrowUpRight,
  Eye,
  FileSpreadsheet,
  ExternalLink,
  Inbox,
  Filter,
  GripVertical,
  User,
  MapPin,
  Globe,
  DollarSign,
  Lock,
  ShieldCheck,
  Smile,
  ThumbsUp,
  Palette,
  Minus,
  HeartCrack,
  Mic,
  Video,
  Calculator,
  EyeOff,
  ListCollapse,
  CalendarDays,
  LayoutTemplate,
  BookmarkCheck,
  ListCheck,
  Edit3,
} from "lucide-react";
import Link from "next/link";
import { nanoid } from "nanoid";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableQuestionCard } from "./SortableQuestionCard";
import MediaPickerModal from "./MediaPickerModal";
import TextareaAutosize from "react-textarea-autosize";
import PublishReadiness from "./PublishReadiness";
import GuidedQuizEditor from "./GuidedQuizEditor";
import { useAutosave } from "@/hooks/useAutosave";
import { FormSchema } from "@/lib/schema";
import {
  record,
  displayTypes,
  singleTypes,
  validateFormReferences,
} from "@/lib/engine";
import ResultsChart from "./ResultsChart";
import TrackingStudio from "./TrackingStudio";
import { publicationFingerprint } from "@/lib/publication";
import AnswerScoring, { ScoringMode } from "./AnswerScoring";
import ThemeEditor from "./ThemeEditor";
import ContactsStudio from "./ContactsStudio";
import MarketingStudio from "./MarketingStudio";
import MarketingResultCard from "./MarketingResultCard";
import IntegrationStudio from "./IntegrationStudio";

interface EditorStudioProps {
  initialForm: FormSchemaType;
  guest?: boolean;
  initiallyPublished?: boolean;
  publishedFingerprint?: string;
}

export default function EditorStudio({ initialForm, guest = false, initiallyPublished = false, publishedFingerprint = "" }: EditorStudioProps) {
  const [guided, setGuided] = useState(guest || (!initiallyPublished && Boolean(initialForm.marketing)));
  useEffect(() => { try { const mode = localStorage.getItem(`pippi-editor-mode:${initialForm.id}`); if (mode) setGuided(mode === "guided"); } catch {} }, [initialForm.id]);
  function changeEditorMode(value: boolean) { setGuided(value); try { localStorage.setItem(`pippi-editor-mode:${initialForm.id}`, value ? "guided" : "advanced"); } catch {} }
  const [liveFingerprint, setLiveFingerprint] = useState(publishedFingerprint);
  const [isPublished, setIsPublished] = useState(initiallyPublished);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState<FormSchemaType>(initialForm);
  const [activeNavTab, setActiveNavTab] = useState<
    "edit" | "integrate" | "share" | "results" | "marketing" | "contacts"
  >("edit");
  const [canvasView, setCanvasView] = useState<"cover" | "page" | "ending">(
    "page",
  );
  const [activePageId, setActivePageId] = useState<string>(
    initialForm.pages?.[0]?.id || "page-1",
  );
  const [isCoverMediaPickerOpen, setIsCoverMediaPickerOpen] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    initialForm.questions[0]?.id || null,
  );
  const [searchFieldQuery, setSearchFieldQuery] = useState("");
  const [devicePreview, setDevicePreview] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const {
    status: saveStatus,
    error: saveError,
    authRequired,
    storageWarning,
    saveNow,
    recovery,
    dismissRecovery,
  } = useAutosave(form, guest);
  const [mobilePanel, setMobilePanel] = useState<"fields" | "settings" | null>(
    null,
  );
  const [actionError, setActionError] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  // Page Management Helpers
  const addPage = () => {
    const nextNum = (form.pages?.length || 1) + 1;
    const newPageId = `page-${nanoid(6)}`;
    const newPage: FormPage = {
      id: newPageId,
      title: `Page ${nextNum}`,
      description: "",
      questionIds: [],
    };
    const currentPages =
      form.pages && form.pages.length > 0
        ? form.pages
        : [
            {
              id: "page-1",
              title: "Page 1",
              questionIds: form.questions.map((q) => q.id),
            },
          ];
    setForm((prev) => ({
      ...prev,
      pages: [...currentPages, newPage],
    }));
    setActivePageId(newPageId);
    setCanvasView("page");
  };

  const deletePage = (pageId: string) => {
    const currentPages = form.pages || [];
    if (currentPages.length <= 1) return;
    const remaining = currentPages.filter((p) => p.id !== pageId);
    const targetPageId = remaining[0].id;
    const updatedQuestions = form.questions.map((q) =>
      q.pageId === pageId ? { ...q, pageId: targetPageId } : q,
    );
    setForm((prev) => ({
      ...prev,
      pages: remaining,
      questions: updatedQuestions,
    }));
    if (activePageId === pageId) {
      setActivePageId(targetPageId);
    }
  };

  const renamePage = (pageId: string, newTitle: string) => {
    setForm((prev) => ({
      ...prev,
      pages: (prev.pages || []).map((p) =>
        p.id === pageId ? { ...p, title: newTitle } : p,
      ),
    }));
  };

  // Drag and drop state
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveQuestionId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveQuestionId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = form.questions.findIndex((q) => q.id === active.id);
    const newIndex = form.questions.findIndex((q) => q.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(form.questions, oldIndex, newIndex);
      setForm((prev) => ({ ...prev, questions: reordered }));
    }
  };

  const handleDragCancel = () => {
    setActiveQuestionId(null);
  };

  // Modals
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLogicModal, setShowLogicModal] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showReadiness, setShowReadiness] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [jsonText, setJsonText] = useState(
    JSON.stringify(initialForm, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Agent generation state
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentNumQuestions, setAgentNumQuestions] = useState(5);
  const [agentDifficulty, setAgentDifficulty] = useState<
    "beginner" | "intermediate" | "advanced"
  >("intermediate");
  const [isAgentGenerating, setIsAgentGenerating] = useState(false);

  // Results & Submissions state
  const [submissions, setSubmissions] = useState<QuizSubmissionResult[]>([]);
  const [submissionStats, setSubmissionStats] = useState<{
    total: number;
    passedCount: number;
    failedCount: number;
    passRate: number;
    averageScore: number;
    tierDistribution: Record<string, number>;
    starts?: number;
    completionRate?: number;
    funnel?: { id: string; title: string; viewed: number }[];
  }>({
    total: 0,
    passedCount: 0,
    failedCount: 0,
    passRate: 0,
    averageScore: 0,
    tierDistribution: {},
  });
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [selectedSubmission, setSelectedSubmission] =
    useState<QuizSubmissionResult | null>(null);

  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/submissions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load results.");
      setSubmissions(data.submissions || []);
      if (data.stats) setSubmissionStats(data.stats);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not load results.",
      );
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (activeNavTab !== "results") return;
    let cancelled = false;
    fetch(`/api/forms/${form.id}/submissions`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setSubmissions(data.submissions);
          setSubmissionStats(data.stats);
          setIsLoadingSubmissions(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setActionError(
            err instanceof Error ? err.message : "Could not load results.",
          );
          setIsLoadingSubmissions(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeNavTab, form.id]);

  const handleDeleteSubmission = async (subId: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    try {
      const response = await fetch(
        `/api/forms/${form.id}/submissions?submissionId=${subId}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not delete response.",
        );
      setSubmissions((prev) => prev.filter((s) => s.id !== subId));
      fetchSubmissions();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not delete response.",
      );
    }
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) return;

    const qHeaders = form.questions.map(
      (q, i) => `"Q${i + 1}: ${q.title.replace(/"/g, '""')}"`,
    );
    const headerRow = [
      '"Submission ID"',
      '"Date & Time"',
      '"Score %"',
      '"Points Earned"',
      '"Total Possible"',
      '"Passed"',
      '"Outcome Tier"',
      '"Marketing Result"',
      '"Category Scores"',
      ...qHeaders,
    ].join(",");

    const rows = submissions.map((sub) => {
      const qValues = form.questions.map((q) => {
        const grading = sub.grading?.find((g) => g.questionId === q.id);
        const ans =
          grading?.userAnswer !== undefined
            ? grading.userAnswer
            : sub.answers?.[q.id];
        let displayStr = "";
        if (ans === undefined || ans === null) displayStr = "";
        else if (Array.isArray(ans)) displayStr = ans.join("; ");
        else if (typeof ans === "object") displayStr = JSON.stringify(ans);
        else displayStr = String(ans);
        return `"${(/^[=+@\-\t\r]/.test(displayStr) ? "'" : "") + displayStr.replace(/"/g, '""')}"`;
      });

      return [
        `"${sub.id || ""}"`,
        `"${new Date(sub.submittedAt).toLocaleString()}"`,
        sub.percentageScore,
        sub.totalPointsEarned,
        sub.totalPointsPossible,
        sub.marketing
          ? '"Recorded"'
          : sub.passed
            ? '"Passed"'
            : '"Needs Review"',
        `"${(sub.matchedTier?.title || "").replace(/"/g, '""')}"`,
        `"${(sub.marketing?.title || "").replace(/"/g, '""').replace(/^[=+@\-]/, "'$&")}"`,
        `"${(sub.marketing?.categories.map((c) => `${c.title}: ${c.score === null ? "Not enough information" : c.score + "%"}`).join("; ") || "").replace(/"/g, '""').replace(/^[=+@\-]/, "'$&")}"`,
        ...qValues,
      ].join(",");
    });

    const csvContent = [headerRow, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${form.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-submissions.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSubmissions = submissions.filter((sub) => {
    if (!submissionSearch) return true;
    const q = submissionSearch.toLowerCase();
    const idMatch = (sub.id || "").toLowerCase().includes(q);
    const tierMatch = (sub.marketing?.title || sub.matchedTier?.title || "")
      .toLowerCase()
      .includes(q);
    const scoreMatch = String(sub.percentageScore).includes(q);
    const statusMatch = (sub.passed ? "passed" : "needs review").includes(q);
    return idMatch || tierMatch || scoreMatch || statusMatch;
  });

  // Keep JSON view updated

  const selectedQuestion = form.questions.find(
    (q) => q.id === selectedQuestionId,
  );
  const activeQuestion = activeQuestionId
    ? form.questions.find((q) => q.id === activeQuestionId)
    : null;
  const totalPoints = form.questions.reduce(
    (sum, q) => sum + (q.points ?? 0),
    0,
  );

  const formPages: FormPage[] =
    form.pages && form.pages.length > 0
      ? form.pages
      : [
          {
            id: "page-1",
            title: "Page 1",
            questionIds: form.questions.map((q) => q.id),
          },
        ];

  const displayedQuestions = form.questions.filter((q) => {
    const qPageId = q.pageId || formPages[0].id;
    return qPageId === activePageId;
  });

  // Logic Rule Helpers
  const logicRules: LogicRule[] = form.logicRules || [];

  const handleAddLogicRule = () => {
    const firstQ = form.questions[0];
    const secondQ = form.questions[1] || firstQ;
    const initialVal = firstQ?.options?.[0]?.id || "";
    const newRule: LogicRule = {
      id: `rule-${nanoid(6)}`,
      sourceQuestionId: firstQ ? firstQ.id : "",
      operator: "equals",
      value: initialVal,
      action: "jump_to_question",
      targetQuestionId: secondQ ? secondQ.id : "",
    };
    setForm((prev) => ({
      ...prev,
      logicRules: [...(prev.logicRules || []), newRule],
    }));
  };

  const handleUpdateLogicRule = (id: string, updates: Partial<LogicRule>) => {
    setForm((prev) => ({
      ...prev,
      logicRules: (prev.logicRules || []).map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
  };

  const handleRemoveLogicRule = (id: string) => {
    setForm((prev) => ({
      ...prev,
      logicRules: (prev.logicRules || []).filter((r) => r.id !== id),
    }));
  };

  // Add Question Helpers
  const addQuestion = (type: QuestionType, insertIndex?: number) => {
    const newId = `q-${nanoid(6)}`;
    const newQ: Question = {
      id: newId,
      type,
      title: getDefaultQuestionTitle(type),
      description: "",
      required: true,
      points: 10,
      shuffleOptions: false,
      pageId: activePageId,
    };

    if (
      type === "multiple_choice" ||
      type === "multiselect" ||
      type === "dropdown" ||
      type === "checkboxes"
    ) {
      newQ.options = [
        { id: nanoid(4), label: "Option 1", isCorrect: true, explanation: "" },
        { id: nanoid(4), label: "Option 2", isCorrect: false, explanation: "" },
        { id: nanoid(4), label: "Option 3", isCorrect: false, explanation: "" },
      ];
      newQ.explanation = "Explanation for the correct answer.";
    } else if (type === "picture_choice" || type === "image_multiselect") {
      newQ.pictureColumns = 3;
      newQ.pictureAspectRatio = "landscape";
      newQ.options = [
        {
          id: nanoid(4),
          label: "Mountain Sunrise",
          imageUrl:
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80",
          isCorrect: true,
          explanation: "Golden hour peaks provide high dynamic contrast.",
        },
        {
          id: nanoid(4),
          label: "Ocean Horizon",
          imageUrl:
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
          isCorrect: false,
          explanation: "",
        },
        {
          id: nanoid(4),
          label: "Forest Mist",
          imageUrl:
            "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80",
          isCorrect: false,
          explanation: "",
        },
      ];
      newQ.explanation = "Mountain Sunrise is the correct selection.";
    } else if (type === "segmented") {
      newQ.options = [
        { id: nanoid(4), label: "First", isCorrect: true },
        { id: nanoid(4), label: "Second", isCorrect: false },
        { id: nanoid(4), label: "Third", isCorrect: false },
      ];
    } else if (type === "switch") {
      newQ.options = [
        { id: "true", label: "True", isCorrect: true, explanation: "Correct!" },
        {
          id: "false",
          label: "False",
          isCorrect: false,
          explanation: "Incorrect",
        },
      ];
    } else if (type === "checkbox") {
      newQ.placeholder = "I confirm and acknowledge the above";
      newQ.points = 0;
    } else if (type === "terms") {
      newQ.termsText = "I agree to the Terms of Service and Privacy Policy";
      newQ.termsUrl = "https://example.com/terms";
      newQ.points = 0;
    } else if (type === "choice_matrix" || type === "matrix_multiselect") {
      newQ.rows = ["Ease of use", "Speed & Performance", "Customer Support"];
      newQ.columns = ["Poor", "Fair", "Good", "Excellent"];
    } else if (type === "like_dislike") {
      newQ.options = [
        { id: "like", label: "Like", isCorrect: true },
        { id: "dislike", label: "Dislike", isCorrect: false },
      ];
    } else if (type === "ranking") {
      newQ.items = ["First Priority", "Second Priority", "Third Priority"];
    } else if (
      type === "short_answer" ||
      type === "email" ||
      type === "phone" ||
      type === "number" ||
      type === "website" ||
      type === "password"
    ) {
      newQ.correctAnswerText = "";
      newQ.placeholder =
        type === "email"
          ? "name@example.com"
          : type === "phone"
            ? "+1 (555) 000-0000"
            : type === "website"
              ? "https://example.com"
              : type === "password"
                ? "Enter password"
                : "Type your answer...";
    } else if (type === "currency") {
      newQ.currencySymbol = "$";
      newQ.placeholder = "0.00";
    } else if (
      type === "opinion_scale" ||
      type === "rating" ||
      type === "nps"
    ) {
      newQ.minRating = 1;
      newQ.maxRating = type === "nps" ? 10 : 5;
      newQ.ratingLabels = { low: "Not likely", high: "Extremely likely" };
    } else if (type === "emoji_rating") {
      newQ.minRating = 1;
      newQ.maxRating = 5;
    } else if (type === "thumbs") {
      newQ.options = [
        { id: "up", label: "Thumbs Up", isCorrect: true },
        { id: "down", label: "Thumbs Down", isCorrect: false },
      ];
    } else if (type === "slider") {
      newQ.minVal = 0;
      newQ.maxVal = 100;
      newQ.stepVal = 5;
    } else if (type === "audio_recorder") {
      newQ.placeholder = "Record audio submission";
    } else if (type === "datetime") {
      newQ.placeholder = "Select date and time";
    } else if (type === "date_range") {
      newQ.placeholder = "Select date range";
    } else if (type === "scheduler") {
      newQ.timeSlots = ["09:00 AM", "10:30 AM", "01:00 PM", "03:30 PM"];
    } else if (type === "image_upload") {
      newQ.maxFiles = 1;
      newQ.maxFileSizeMB = 10;
    } else if (type === "video_embed") {
      newQ.videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      newQ.points = 0;
    } else if (type === "image_display") {
      newQ.mediaUrl =
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80";
      newQ.points = 0;
    } else if (type === "rich_text") {
      newQ.richTextContent =
        "### Background & Instructions\nProvide detailed text, markdown instructions, or resources here.";
      newQ.points = 0;
    } else if (type === "accordion") {
      newQ.accordionItems = [
        {
          id: nanoid(4),
          title: "What are the rules?",
          content: "Please read each question carefully before submitting.",
        },
        {
          id: nanoid(4),
          title: "How is score computed?",
          content: "Points are tallied automatically upon completion.",
        },
      ];
      newQ.points = 0;
    } else if (type === "calculation") {
      newQ.calculationFormula = "[Total Score] = Sum of points";
      newQ.points = 0;
    } else if (type === "hidden") {
      newQ.hiddenParamName = "utm_source";
      newQ.points = 0;
    } else if (type === "captcha") {
      newQ.placeholder = "Verify human challenge";
      newQ.points = 0;
    } else if (type === "heading") {
      newQ.title = "Section Header";
      newQ.points = 0;
    } else if (type === "subheading") {
      newQ.title = "Section Subheading";
      newQ.subheadingText = "Secondary section context or instructions";
      newQ.points = 0;
    } else if (type === "banner") {
      newQ.title = "Important Notice";
      newQ.description = "Provide important context or instructions here.";
      newQ.points = 0;
    } else if (type === "divider") {
      newQ.title = "Divider";
      newQ.points = 0;
    }

    if (displayTypes.has(type)) newQ.required = false;
    if (["choice_matrix", "matrix_multiselect"].includes(type)) newQ.points = 0;
    if (type === "calculation") newQ.calculationFormula = "0";
    const updatedQuestions = [...form.questions];
    if (insertIndex !== undefined && insertIndex >= 0) {
      updatedQuestions.splice(insertIndex, 0, newQ);
    } else {
      updatedQuestions.push(newQ);
    }

    setForm({ ...form, questions: updatedQuestions });
    setSelectedQuestionId(newId);
    setCanvasView("page");
    setMobilePanel(null);
  };

  const updateQuestion = (qId: string, updates: Partial<Question>) => {
    const updated = form.questions.map((q) =>
      q.id === qId ? { ...q, ...updates } : q,
    );
    setForm({
      ...form,
      questions: updated,
      marketing: form.marketing
        ? {
            ...form.marketing,
            rules: form.marketing.rules.filter(
              (r) =>
                r.questionId !== qId ||
                updated
                  .find((q) => q.id === qId)
                  ?.options?.some((o) => o.id === r.answerId),
            ),
          }
        : undefined,
    });
  };

  const deleteQuestion = (qId: string) => {
    const updated = form.questions.filter((q) => q.id !== qId);
    setForm({
      ...form,
      questions: updated,
      marketing: form.marketing
        ? {
            ...form.marketing,
            rules: form.marketing.rules.filter((r) => r.questionId !== qId),
          }
        : undefined,
      logicRules: form.logicRules?.filter(
        (r) => r.sourceQuestionId !== qId && r.targetQuestionId !== qId,
      ),
    });
    if (selectedQuestionId === qId) {
      setSelectedQuestionId(updated[0]?.id || null);
    }
  };

  const duplicateQuestion = (qId: string) => {
    const targetIdx = form.questions.findIndex((q) => q.id === qId);
    if (targetIdx === -1) return;
    const target = form.questions[targetIdx];
    const clone: Question = {
      ...target,
      id: `q-${nanoid(6)}`,
      title: `${target.title} (Copy)`,
      options: target.options?.map((o) => ({ ...o, id: nanoid(4) })),
    };
    const updated = [...form.questions];
    updated.splice(targetIdx + 1, 0, clone);
    setForm({ ...form, questions: updated });
    setSelectedQuestionId(clone.id);
  };

  const moveQuestion = (qId: string, direction: "up" | "down") => {
    const idx = form.questions.findIndex((q) => q.id === qId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === form.questions.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = [...form.questions];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setForm({ ...form, questions: updated });
  };

  // Option Handlers
  const addOption = (qId: string) => {
    const q = form.questions.find((x) => x.id === qId);
    if (!q) return;
    const isPicture = q.type === "picture_choice";
    const sampleImages = [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80",
    ];
    const nextImg = isPicture
      ? sampleImages[(q.options?.length || 0) % sampleImages.length]
      : undefined;

    const newOptions = [
      ...(q.options || []),
      {
        id: nanoid(4),
        label: isPicture
          ? `Picture ${(q.options?.length || 0) + 1}`
          : `Option ${(q.options?.length || 0) + 1}`,
        imageUrl: nextImg,
        isCorrect: false,
      },
    ];
    updateQuestion(qId, { options: newOptions });
  };

  const updateOption = (
    qId: string,
    optId: string,
    updates: Partial<{
      label: string;
      isCorrect: boolean;
      explanation: string;
      imageUrl: string;
    }>,
  ) => {
    const q = form.questions.find((x) => x.id === qId);
    if (!q || !q.options) return;

    const newOptions = q.options.map((opt) => {
      if (opt.id === optId) {
        return { ...opt, ...updates };
      }
      if (singleTypes.has(q.type) && updates.isCorrect) {
        return { ...opt, isCorrect: false };
      }
      return opt;
    });

    updateQuestion(qId, { options: newOptions });
  };

  const deleteOption = (qId: string, optId: string) => {
    const q = form.questions.find((x) => x.id === qId);
    if (!q || !q.options) return;
    const newOptions = q.options.filter((opt) => opt.id !== optId);
    updateQuestion(qId, { options: newOptions });
  };

  const moveOption = (qId: string, optId: string, direction: "up" | "down") => {
    const q = form.questions.find((x) => x.id === qId);
    if (!q || !q.options) return;
    const optIdx = q.options.findIndex((o) => o.id === optId);
    if (optIdx === -1) return;
    if (direction === "up" && optIdx === 0) return;
    if (direction === "down" && optIdx === q.options.length - 1) return;

    const targetIdx = direction === "up" ? optIdx - 1 : optIdx + 1;
    const newOptions = [...q.options];
    const [moved] = newOptions.splice(optIdx, 1);
    newOptions.splice(targetIdx, 0, moved);
    updateQuestion(qId, { options: newOptions });
  };

  // Agent Generate Handler
  const handleAgentGenerate = async () => {
    if (!agentPrompt.trim()) return;
    setIsAgentGenerating(true);
    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: agentPrompt,
          save: false,
          numQuestions: agentNumQuestions,
          difficulty: agentDifficulty,
          mode: form.mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      if (data.form) {
        const generated = FormSchema.parse(data.form);
        setForm({
          ...generated,
          id: form.id,
          revision: form.revision,
          createdAt: form.createdAt,
        });
        setActivePageId(generated.pages?.[0]?.id || "page-1");
        setCanvasView("page");
        setSelectedQuestionId(data.form.questions[0]?.id || null);
        setShowAgentModal(false);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsAgentGenerating(false);
    }
  };

  // Apply JSON Changes
  const applyJsonChanges = () => {
    try {
      const parsed = FormSchema.parse(JSON.parse(jsonText));
      validateFormReferences(parsed);
      setForm(parsed);
      setJsonError(null);
      setShowJsonModal(false);
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON syntax");
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/play/${form.id}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handlePublish = async (confirmed = false) => {
    if (publishing) return;
    if (!confirmed) { setShowReadiness(true); return; }
    setActionError("");
    setPublishing(true);
    try {
      if (!(await saveNow())) { setShowReadiness(false); return; }
      const res = await fetch(`/api/forms/${form.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publishing failed.");
      setLiveFingerprint(publicationFingerprint(form));
      setIsPublished(true);
      setShowReadiness(false);
      setShowPublishModal(true);
    } catch (err) {
      setShowReadiness(false);
      setActionError(err instanceof Error ? err.message : "Publishing failed.");
    } finally { setPublishing(false); }
  };

  // Field Palette Categories (Comprehensive 51-Field Catalog - Beats Fillout's 48)
  const PALETTE_SECTIONS = [
    {
      category: "Text & Contact",
      items: [
        {
          type: "short_answer" as QuestionType,
          label: "Short answer",
          icon: Type,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "paragraph" as QuestionType,
          label: "Paragraph",
          icon: AlignLeft,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "email" as QuestionType,
          label: "Email address",
          icon: Mail,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "phone" as QuestionType,
          label: "Phone number",
          icon: Phone,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "full_name" as QuestionType,
          label: "Full name",
          icon: User,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "address" as QuestionType,
          label: "Address",
          icon: MapPin,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "website" as QuestionType,
          label: "Website URL",
          icon: Globe,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "number" as QuestionType,
          label: "Number",
          icon: Hash,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "currency" as QuestionType,
          label: "Currency",
          icon: DollarSign,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        {
          type: "password" as QuestionType,
          label: "Password",
          icon: Lock,
          color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
      ],
    },
    {
      category: "Choices & Selection",
      items: [
        {
          type: "multiple_choice" as QuestionType,
          label: "Multiple choice",
          icon: ListOrdered,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "multiselect" as QuestionType,
          label: "Multiselect",
          icon: CheckCircle2,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "dropdown" as QuestionType,
          label: "Dropdown",
          icon: Sliders,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "picture_choice" as QuestionType,
          label: "Picture choice",
          icon: ImageIcon,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "image_multiselect" as QuestionType,
          label: "Image multi-select",
          icon: ImageIcon,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "segmented" as QuestionType,
          label: "Segmented",
          icon: SlidersHorizontal,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "switch" as QuestionType,
          label: "Switch (True/False)",
          icon: ToggleLeft,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "checkbox" as QuestionType,
          label: "Single checkbox",
          icon: CheckSquare,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "checkboxes" as QuestionType,
          label: "Checkboxes list",
          icon: CheckSquare,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "terms" as QuestionType,
          label: "Terms & Conditions",
          icon: ShieldCheck,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "choice_matrix" as QuestionType,
          label: "Choice matrix",
          icon: Grid,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "matrix_multiselect" as QuestionType,
          label: "Matrix multi-select",
          icon: Grid,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
        {
          type: "ranking" as QuestionType,
          label: "Ranking",
          icon: ListOrdered,
          color: "bg-amber-50 text-amber-600 border-amber-200",
        },
      ],
    },
    {
      category: "Ratings & Feedback",
      items: [
        {
          type: "rating" as QuestionType,
          label: "Rating (Stars)",
          icon: Star,
          color: "bg-purple-50 text-purple-600 border-purple-200",
        },
        {
          type: "opinion_scale" as QuestionType,
          label: "Opinion scale",
          icon: Hash,
          color: "bg-purple-50 text-purple-600 border-purple-200",
        },
        {
          type: "nps" as QuestionType,
          label: "NPS Score",
          icon: Heart,
          color: "bg-purple-50 text-purple-600 border-purple-200",
        },
        {
          type: "slider" as QuestionType,
          label: "Slider",
          icon: SlidersHorizontal,
          color: "bg-purple-50 text-purple-600 border-purple-200",
        },
        {
          type: "emoji_rating" as QuestionType,
          label: "Emoji rating",
          icon: Smile,
          color: "bg-purple-50 text-purple-600 border-purple-200",
        },
        {
          type: "thumbs" as QuestionType,
          label: "Thumbs Up / Down",
          icon: ThumbsUp,
          color: "bg-purple-50 text-purple-600 border-purple-200",
        },
        {
          type: "like_dislike" as QuestionType,
          label: "Like / Dislike",
          icon: HeartCrack,
          color: "bg-purple-50 text-purple-600 border-purple-200",
        },
        {
          type: "audio_recorder" as QuestionType,
          label: "Voice note recorder",
          icon: Mic,
          color: "bg-purple-50 text-purple-600 border-purple-200",
        },
      ],
    },
    {
      category: "Date, Time & Scheduling",
      items: [
        {
          type: "date" as QuestionType,
          label: "Date picker",
          icon: Calendar,
          color: "bg-blue-50 text-blue-600 border-blue-200",
        },
        {
          type: "time" as QuestionType,
          label: "Time picker",
          icon: Clock,
          color: "bg-blue-50 text-blue-600 border-blue-200",
        },
        {
          type: "datetime" as QuestionType,
          label: "Date & Time",
          icon: Clock,
          color: "bg-blue-50 text-blue-600 border-blue-200",
        },
        {
          type: "date_range" as QuestionType,
          label: "Date Range",
          icon: CalendarDays,
          color: "bg-blue-50 text-blue-600 border-blue-200",
        },
        {
          type: "scheduler" as QuestionType,
          label: "Meeting preference",
          icon: Calendar,
          color: "bg-blue-50 text-blue-600 border-blue-200",
        },
      ],
    },
    {
      category: "Media & Signatures",
      items: [
        {
          type: "file_upload" as QuestionType,
          label: "File upload",
          icon: UploadCloud,
          color: "bg-sky-50 text-sky-600 border-sky-200",
        },
        {
          type: "image_upload" as QuestionType,
          label: "Image upload",
          icon: ImageIcon,
          color: "bg-sky-50 text-sky-600 border-sky-200",
        },
        {
          type: "signature" as QuestionType,
          label: "Typed signature",
          icon: PenTool,
          color: "bg-sky-50 text-sky-600 border-sky-200",
        },
        {
          type: "color_picker" as QuestionType,
          label: "Color picker",
          icon: Palette,
          color: "bg-sky-50 text-sky-600 border-sky-200",
        },
        {
          type: "video_embed" as QuestionType,
          label: "Video embed",
          icon: Video,
          color: "bg-sky-50 text-sky-600 border-sky-200",
        },
      ],
    },
    {
      category: "Display & Layout",
      items: [
        {
          type: "heading" as QuestionType,
          label: "Heading (H1)",
          icon: FileText,
          color: "bg-indigo-50 text-indigo-600 border-indigo-200",
        },
        {
          type: "subheading" as QuestionType,
          label: "Subheading",
          icon: FileText,
          color: "bg-indigo-50 text-indigo-600 border-indigo-200",
        },
        {
          type: "banner" as QuestionType,
          label: "Banner callout",
          icon: Sparkles,
          color: "bg-indigo-50 text-indigo-600 border-indigo-200",
        },
        {
          type: "divider" as QuestionType,
          label: "Divider line",
          icon: Minus,
          color: "bg-indigo-50 text-indigo-600 border-indigo-200",
        },
        {
          type: "image_display" as QuestionType,
          label: "Image figure",
          icon: ImageIcon,
          color: "bg-indigo-50 text-indigo-600 border-indigo-200",
        },
        {
          type: "rich_text" as QuestionType,
          label: "Rich text block",
          icon: AlignLeft,
          color: "bg-indigo-50 text-indigo-600 border-indigo-200",
        },
        {
          type: "accordion" as QuestionType,
          label: "Accordion FAQ",
          icon: ListCollapse,
          color: "bg-indigo-50 text-indigo-600 border-indigo-200",
        },
      ],
    },
    {
      category: "Advanced & Logic",
      items: [
        {
          type: "calculation" as QuestionType,
          label: "Calculation formula",
          icon: Calculator,
          color: "bg-teal-50 text-teal-600 border-teal-200",
        },
        {
          type: "hidden" as QuestionType,
          label: "Hidden variable",
          icon: EyeOff,
          color: "bg-teal-50 text-teal-600 border-teal-200",
        },
        {
          type: "captcha" as QuestionType,
          label: "CAPTCHA challenge",
          icon: ShieldCheck,
          color: "bg-teal-50 text-teal-600 border-teal-200",
        },
      ],
    },
  ];

  return (
    <div className="hq-editor h-screen flex flex-col bg-[#f4f5f7] text-gray-900 overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {guest && (
        <div className="bg-red-50 text-red-950 px-5 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>Build your quiz for free. Your draft stays in this browser. Create a free account to save and publish. No charges.</span>
          <button className="font-semibold underline" onClick={() => void saveNow()}>Save my quiz</button>
        </div>
      )}
      {storageWarning && <p role="alert" className="bg-amber-50 text-amber-950 px-5 py-3 text-sm">Browser backup is unavailable. Keep this tab open until your changes show Saved.</p>}
      {(saveError || actionError) && (
        <div
          role="alert"
          className="hq-error fixed bottom-5 left-1/2 -translate-x-1/2 z-[10000] w-[calc(100%-2rem)] max-w-xl shadow-lg"
        >
          {authRequired ? (
            <div>
              <p className="font-semibold">Sign in to save your quiz</p>
              <p className="mt-1 text-sm">
                {guest
                  ? "Create a free account or sign in in a new tab. After confirming your email and signing in, return here and retry saving. Your draft stays in this browser. All accounts are free—no charges or credit card."
                  : "Keep this editor tab open so you don’t lose your edits. Sign in with the account that owns this quiz, then return here and retry saving. New to pippi? You can create an account in a new tab."}
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                {/* A separate tab keeps the unsaved editor state intact during authentication. */}
                <a href="/login" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Sign in ↗</a>
                <a href="/signup" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Create account ↗</a>
              </div>
            </div>
          ) : (saveError || actionError)}
          <button
            className="ml-4 underline"
            onClick={() => {
              setActionError("");
              void saveNow();
            }}
          >
            Retry save
          </button>
        </div>
      )}
      {recovery && (
        <div className="bg-amber-50 text-amber-900 text-sm px-6 py-3 flex gap-4">
          Unsaved edits from your previous session are available.
          <button
            className="font-semibold underline"
            onClick={() => {
              setForm({ ...recovery, revision: form.revision });
              dismissRecovery();
            }}
          >
            Restore changes
          </button>
          <button className="underline" onClick={dismissRecovery}>
            Dismiss
          </button>
        </div>
      )}
      {guided && <GuidedQuizEditor form={form} onChange={setForm} onAdvanced={() => changeEditorMode(false)} onTheme={() => setShowThemeModal(true)} onPublish={() => void handlePublish()} onSave={() => void saveNow()} onPreview={async () => { if (guest) { void saveNow(); return; } const tab = window.open("about:blank", "_blank"); if (tab) tab.opener = null; if (await saveNow()) { if (tab) tab.location.href = `/play/${form.id}?preview=1`; else setActionError("Preview was blocked by your browser. Allow popups and try again."); } else tab?.close(); }} status={guest ? "Draft stored in this browser" : saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : "Unsaved changes"} published={isPublished} />}
      {!guided && <>
      {/* 1. FILLOUT TOP NAVIGATION BAR */}
      <header className="min-h-14 py-2 gap-2 flex-wrap border-b border-gray-200 bg-white px-4 flex items-center justify-between shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            onClick={async (e) => {
              e.preventDefault();
              if (await saveNow()) window.location.assign("/");
            }}
            className="flex items-center pr-2.5 border-r border-gray-200 transition hover:opacity-85"
            title="pippi - Back to Dashboard"
          >
            <img
              src="/pippi-logo.svg"
              alt="pippi"
              className="h-6 w-auto object-contain"
            />
          </Link>

          <div className="flex items-center gap-1 group cursor-pointer">
            <input
              type="text"
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-transparent hover:bg-gray-100/70 focus:bg-white font-semibold text-sm text-gray-900 px-2 py-1 rounded-md border border-transparent hover:border-gray-200 focus:border-indigo-500 outline-none transition max-w-[200px] sm:max-w-xs truncate"
            />
            <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
          </div>

          <span className="text-xs text-gray-400 flex items-center gap-1 ml-2 font-mono">
            {saveStatus === "saving" && (
              <span className="text-amber-500 animate-pulse">Saving...</span>
            )}
            {saveStatus === "saved" && !guest && (
              <span className="text-emerald-600 flex items-center gap-1 font-medium">
                <Check className="w-3 h-3 stroke-[3]" /> Saved
              </span>
            )}
            {saveStatus === "unsaved" && (
              <span className="text-gray-400">Unsaved edits</span>
            )}
            {saveStatus === "error" && (
              <button
                className="text-rose-600 underline"
                onClick={() => void saveNow()}
              >
                {guest ? "Sign in to save" : "Save failed · Retry"}
              </button>
            )}
          </span>
        </div>

        <button
          className="hq-secondary !px-3 !py-2 lg:hidden"
          onClick={() =>
            setMobilePanel(mobilePanel === "fields" ? null : "fields")
          }
        >
          Fields
        </button>
        <button
          className="hq-secondary !px-3 !py-2 lg:hidden"
          onClick={() =>
            setMobilePanel(mobilePanel === "settings" ? null : "settings")
          }
        >
          Question settings
        </button>
        <button className="hq-secondary" onClick={() => changeEditorMode(true)}>Guided setup</button>
        {/* Center Fillout Tabs Capsule */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200/60">
          <button
            onClick={() => setActiveNavTab("edit")}
            className={`px-3.5 py-1 rounded-lg text-xs font-medium transition ${
              activeNavTab === "edit"
                ? "bg-white text-gray-900 shadow-xs font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Pencil size={14} aria-hidden="true" className="inline-block mr-1.5 align-text-bottom" />Edit
          </button>

          <button onClick={() => guest ? void saveNow() : setActiveNavTab("contacts")} className={`px-3.5 py-1 rounded-lg text-xs font-medium ${activeNavTab === "contacts" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"}`}><Users size={14} aria-hidden="true" className="inline-block mr-1.5 align-text-bottom" />Contacts</button>
          <button
            onClick={() => setActiveNavTab("marketing")}
            className={`px-3.5 py-1 rounded-lg text-xs font-medium transition ${activeNavTab === "marketing" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"}`}
          >
            <Sparkles size={14} aria-hidden="true" className="inline-block mr-1.5 align-text-bottom" />Marketing
          </button>
          <button
            onClick={() => guest ? void saveNow() : setActiveNavTab("integrate")}
            className={`px-3.5 py-1 rounded-lg text-xs font-medium transition ${
              activeNavTab === "integrate"
                ? "bg-white text-gray-900 shadow-xs font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Plug size={14} aria-hidden="true" className="inline-block mr-1.5 align-text-bottom" />Integrate
          </button>

          <button
            onClick={() => guest ? void saveNow() : setActiveNavTab("share")}
            className={`px-3.5 py-1 rounded-lg text-xs font-medium transition ${
              activeNavTab === "share"
                ? "bg-white text-gray-900 shadow-xs font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Share2 size={14} aria-hidden="true" className="inline-block mr-1.5 align-text-bottom" />Share
          </button>

          <button
            onClick={() => guest ? void saveNow() : setActiveNavTab("results")}
            className={`px-3.5 py-1 rounded-lg text-xs font-medium transition ${
              activeNavTab === "results"
                ? "bg-white text-gray-900 shadow-xs font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <BarChart3 size={14} aria-hidden="true" className="inline-block mr-1.5 align-text-bottom" />Results
          </button>
        </div>

        <button
          className="hq-secondary !px-3 !py-2 text-xs"
          onClick={() => {
            setSelectedQuestionId(null);
            setActiveNavTab("edit");
            setMobilePanel("settings");
          }}
        >
          <Settings size={15} /> Form settings
        </button>
        {/* Right Fillout Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Keep theme controls outside the scrolling canvas in every editor view. */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-300 shadow-xs transition flex items-center gap-1.5"
          >
            <Paintbrush className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Theme</span>
          </button>
          <ScoringMode form={form} onChange={setForm} />
          <span className="text-xs font-semibold text-gray-600">{!isPublished ? "Draft · Not public" : liveFingerprint !== publicationFingerprint(form) ? "Published · Unpublished changes" : "Published · Up to date"}</span>
          {/* Device Mockup Toggle */}
          <div className="hidden sm:flex items-center bg-gray-100 border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setDevicePreview("desktop")}
              className={`p-1.5 rounded-md text-xs transition ${
                devicePreview === "desktop"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Desktop View"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDevicePreview("mobile")}
              className={`p-1.5 rounded-md text-xs transition ${
                devicePreview === "mobile"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Mobile Mockup"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* JSON Schema Button */}
          <button
            onClick={() => {
              setJsonText(JSON.stringify(form, null, 2));
              setShowJsonModal(true);
            }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition border border-gray-200"
            title="Declarative Schema JSON"
          >
            <Code2 className="w-4 h-4" />
          </button>

          {/* Preview Button */}
          <Link
            onClick={guest ? (e) => { e.preventDefault(); void saveNow(); } : undefined}
            href={guest ? "/create" : `/play/${form.id}?preview=1`}
            target="_blank"
            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-300 shadow-xs transition flex items-center gap-1.5"
          >
            <Play className="w-3 h-3 fill-gray-600 text-gray-600" />
            <span>{guest ? "Save to preview" : "Preview"}</span>
          </Link>

          {/* Publish Button */}
          <button
            onClick={() => void handlePublish()}
            className="px-4 py-1.5 rounded-lg bg-[#18181b] hover:bg-black text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>Publish</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-COLUMN STUDIO LAYOUT */}
      {activeNavTab === "edit" && (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT COLUMN: FILLOUT FIELD PALETTE */}
          <aside
            className={`hq-field-palette w-64 border-r border-gray-200 bg-white flex flex-col shrink-0 ${mobilePanel === "fields" ? "mobile-open" : ""}`}
          >
            <button
              className="hq-secondary m-3 lg:hidden"
              onClick={() => setMobilePanel(null)}
            >
              Close fields
            </button>
            {/* Search Fields Input */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search fields"
                  value={searchFieldQuery}
                  onChange={(e) => setSearchFieldQuery(e.target.value)}
                  className="w-full bg-gray-50/80 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 outline-none transition"
                />
              </div>
            </div>

            {/* Categorized Field Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {PALETTE_SECTIONS.map((section) => {
                const filteredItems = section.items.filter((item) =>
                  item.label
                    .toLowerCase()
                    .includes(searchFieldQuery.toLowerCase()),
                );
                if (filteredItems.length === 0) return null;

                return (
                  <div key={section.category} className="space-y-2">
                    <span className="text-[11px] font-semibold text-gray-400 block px-1">
                      {section.category}
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      {filteredItems.map((item) => {
                        const IconComp = item.icon;
                        return (
                          <button
                            key={item.type}
                            onClick={() => addQuestion(item.type)}
                            className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200/80 hover:border-gray-300 bg-white hover:bg-gray-50/80 transition-all group text-center cursor-pointer shadow-xs active:scale-95"
                          >
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 border transition ${item.color}`}
                            >
                              <IconComp className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-medium text-gray-700 leading-tight line-clamp-2">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* CENTER COLUMN: FILLOUT CANVAS (WYSIWYG DOCUMENT) */}
          <main
            className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 flex flex-col items-center justify-between relative transition-colors duration-200"
            style={{
              backgroundColor: form.theme?.backgroundColor || "#f4f5f7",
            }}
          >
            <div
              className={`w-full transition-all duration-300 ${
                devicePreview === "mobile"
                  ? "max-w-sm border-[8px] border-gray-800 rounded-[40px] p-5 bg-white shadow-2xl h-[720px] overflow-y-auto my-auto"
                  : "max-w-2xl space-y-4"
              }`}
            >
              {/* Fillout Multi-Page Navigation Bar */}
              <div className="bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-2xl p-1.5 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 min-w-max">
                  {/* Cover Page Tab */}
                  <button
                    type="button"
                    onClick={() => setCanvasView("cover")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      canvasView === "cover"
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 border border-transparent"
                    }`}
                  >
                    <LayoutTemplate className="w-3.5 h-3.5" />
                    <span>Cover</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        form.coverPage?.enabled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {form.coverPage?.enabled ? "ON" : "OFF"}
                    </span>
                  </button>

                  <div className="h-4 w-px bg-gray-200 mx-1" />

                  {/* Dynamic Form Pages Tabs */}
                  {formPages.map((page, pIdx) => {
                    const isCurrentPage =
                      canvasView === "page" && activePageId === page.id;
                    const count = form.questions.filter(
                      (q) => (q.pageId || formPages[0].id) === page.id,
                    ).length;
                    return (
                      <div
                        key={page.id}
                        className={`flex items-center rounded-xl border transition ${
                          isCurrentPage
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActivePageId(page.id);
                            setCanvasView("page");
                          }}
                          className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{page.title || `Page ${pIdx + 1}`}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                              isCurrentPage
                                ? "bg-white/20 text-white"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {count}
                          </span>
                        </button>

                        {/* Delete Page button (if more than 1 page) */}
                        {formPages.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  `Delete "${page.title}" and move its questions to Page 1?`,
                                )
                              ) {
                                deletePage(page.id);
                              }
                            }}
                            title="Delete Page"
                            className={`p-1 mr-1 rounded hover:bg-black/10 transition ${
                              isCurrentPage
                                ? "text-white/80 hover:text-white"
                                : "text-gray-400 hover:text-rose-600"
                            }`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Page Button */}
                  <button
                    type="button"
                    onClick={addPage}
                    className="px-2.5 py-1.5 rounded-xl border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 text-gray-600 hover:text-indigo-600 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Add new page to form"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Page</span>
                  </button>

                  <div className="h-4 w-px bg-gray-200 mx-1" />

                  {/* Ending Screen Tab */}
                  <button
                    type="button"
                    onClick={() => setCanvasView("ending")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      canvasView === "ending"
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 border border-transparent"
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ending</span>
                  </button>
                </div>
              </div>

              {/* White Document Card Container */}
              <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-8 min-h-[500px] space-y-6 relative">
                {/* Canvas assistant */}
                <div className="flex items-center gap-2 pb-2">


                  <button
                    onClick={() => setShowAgentModal(true)}
                    className="px-3.5 py-1.5 rounded-full bg-white hover:bg-indigo-50/60 border border-indigo-200 text-indigo-600 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Bot className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Agent</span>
                  </button>
                </div>

                {/* VIEW 1: COVER PAGE WYSIWYG */}
                {canvasView === "cover" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <LayoutTemplate className="w-5 h-5 text-indigo-600" />
                          <span>Cover / Welcome Screen</span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          First screen shown to respondents before starting
                          questions.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-700">
                          Enable Cover Screen
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(form.coverPage?.enabled)}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setForm((prev) => ({
                              ...prev,
                              coverPage: {
                                enabled,
                                title:
                                  prev.coverPage?.title ||
                                  prev.title ||
                                  "Welcome to the Assessment",
                                subtitle:
                                  prev.coverPage?.subtitle ||
                                  prev.description ||
                                  "Please read instructions carefully before beginning.",
                                buttonText:
                                  prev.coverPage?.buttonText || "Get Started",
                                imageUrl:
                                  prev.coverPage?.imageUrl ||
                                  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
                                estimatedMinutes:
                                  prev.coverPage?.estimatedMinutes || 3,
                                showQuestionCount:
                                  prev.coverPage?.showQuestionCount ?? true,
                              },
                            }));
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                        />
                      </label>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Cover Title
                        </label>
                        <input
                          type="text"
                          value={form.coverPage?.title ?? form.title ?? ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              coverPage: {
                                ...(prev.coverPage || {
                                  enabled: true,
                                  buttonText: "Get Started",
                                }),
                                title: e.target.value,
                              },
                            }))
                          }
                          placeholder="Welcome to the Assessment"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-base font-bold text-gray-900 outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Cover Subtitle &amp; Instructions
                        </label>
                        <textarea
                          rows={3}
                          value={
                            form.coverPage?.subtitle ?? form.description ?? ""
                          }
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              coverPage: {
                                ...(prev.coverPage || {
                                  enabled: true,
                                  title: prev.title || "Assessment",
                                  buttonText: "Get Started",
                                }),
                                subtitle: e.target.value,
                              },
                            }))
                          }
                          placeholder="Give respondents clear instructions, context, or estimated time..."
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-700 outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Start Button Text
                          </label>
                          <input
                            type="text"
                            value={form.coverPage?.buttonText ?? "Get Started"}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                coverPage: {
                                  ...(prev.coverPage || {
                                    enabled: true,
                                    title: prev.title || "Assessment",
                                    buttonText: "Get Started",
                                  }),
                                  buttonText: e.target.value,
                                },
                              }))
                            }
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Estimated Time (Minutes)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={form.coverPage?.estimatedMinutes ?? 3}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                coverPage: {
                                  ...(prev.coverPage || {
                                    enabled: true,
                                    buttonText: "Get Started",
                                    title: prev.title || "Assessment",
                                  }),
                                  estimatedMinutes: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Hero Cover Image URL
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCoverMediaPickerOpen(true)}
                          className="w-full bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4" />
                          {form.coverPage?.imageUrl
                            ? "Change Hero Image"
                            : "Select Hero Image"}
                        </button>
                      </div>

                      {/* Live Preview Card */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                          Live Cover Preview
                        </span>
                        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/50 shadow-xs">
                          {form.coverPage?.imageUrl && (
                            <div className="h-44 w-full bg-gray-100 overflow-hidden relative">
                              <img
                                src={form.coverPage.imageUrl}
                                alt="Cover Hero"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="p-6 text-center space-y-3">
                            <h2 className="text-xl font-bold text-gray-900">
                              {form.coverPage?.title ||
                                form.title ||
                                "Untitled Assessment"}
                            </h2>
                            <p className="text-xs text-gray-500 max-w-md mx-auto">
                              {form.coverPage?.subtitle ||
                                form.description ||
                                "Click below to begin."}
                            </p>
                            <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400 font-mono py-1">
                              <span>
                                ⏱ ~{form.coverPage?.estimatedMinutes || 3} min
                              </span>
                              <span>•</span>
                              <span>📝 {form.questions.length} questions</span>
                            </div>
                            <div>
                              <span className="inline-block px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-sm">
                                {form.coverPage?.buttonText || "Get Started"} →
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 2: FORM QUESTIONS PAGE */}
                {canvasView === "page" && (
                  <>
                    {/* Form Title & Description */}
                    <div className="space-y-2 border-b border-gray-100 pb-5">
                      <TextareaAutosize
                        value={form.title ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        placeholder="Form Title"
                        className="w-full bg-transparent text-2xl font-bold text-gray-900 outline-none placeholder:text-gray-300 resize-none overflow-hidden"
                      />
                      <TextareaAutosize
                        value={form.description ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        placeholder="Add a clear description or instructions..."
                        className="w-full bg-transparent text-xs text-gray-500 outline-none placeholder:text-gray-300 resize-none overflow-hidden"
                      />
                    </div>

                    {/* Active Page Header & Rename Tool */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider font-mono">
                          {formPages.find((p) => p.id === activePageId)
                            ?.title || "Page 1"}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono font-medium">
                          {displayedQuestions.length}{" "}
                          {displayedQuestions.length === 1
                            ? "question"
                            : "questions"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const current = formPages.find(
                            (p) => p.id === activePageId,
                          );
                          const next = window.prompt(
                            "Rename page title:",
                            current?.title || "Page",
                          );
                          if (next && next.trim()) {
                            renamePage(activePageId, next.trim());
                          }
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Rename Page</span>
                      </button>
                    </div>

                    {/* Questions List */}
                    {displayedQuestions.length === 0 ? (
                      /* Fillout Empty State */
                      <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-gray-500 max-w-xs font-medium">
                          No questions on this page yet. Drag or click any field
                          from the palette on the left to add here.
                        </p>
                      </div>
                    ) : !mounted ? (
                      <div className="space-y-5">
                        {displayedQuestions.map((q, idx) => {
                          const isSelected = q.id === selectedQuestionId;
                          const hasLogic = Boolean(
                            form.logicRules?.some(
                              (r) =>
                                r.sourceQuestionId === q.id ||
                                r.targetQuestionId === q.id,
                            ),
                          );
                          return (
                            <SortableQuestionCard
                              key={q.id}
                              q={q}
                              idx={idx}
                              totalQuestions={displayedQuestions.length}
                              isSelected={isSelected}
                              mode={form.marketing ? "survey" : form.mode}
                              scoring={form.marketing ? <AnswerScoring form={form} q={q} onLabelChange={(id,label)=>updateOption(q.id,id,{label})} marketing={form.marketing} onChange={marketing => setForm(current => ({...current, marketing}))} /> : undefined}
                              hasLogic={hasLogic}
                              onSelect={() => setSelectedQuestionId(q.id)}
                              onMoveQuestion={moveQuestion}
                              onDuplicateQuestion={duplicateQuestion}
                              onDeleteQuestion={deleteQuestion}
                              onUpdateQuestion={updateQuestion}
                              onUpdateOption={updateOption}
                              onDeleteOption={deleteOption}
                              onAddOption={addOption}
                              onMoveOption={moveOption}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <DndContext
                        id="heyquiz-canvas-dnd"
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={handleDragCancel}
                      >
                        <SortableContext
                          items={displayedQuestions.map((q) => q.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-5">
                            {displayedQuestions.map((q, idx) => {
                              const isSelected = q.id === selectedQuestionId;
                              const hasLogic = Boolean(
                                form.logicRules?.some(
                                  (r) =>
                                    r.sourceQuestionId === q.id ||
                                    r.targetQuestionId === q.id,
                                ),
                              );
                              return (
                                <SortableQuestionCard
                                  key={q.id}
                                  q={q}
                                  idx={idx}
                                  totalQuestions={displayedQuestions.length}
                                  isSelected={isSelected}
                                  mode={form.marketing ? "survey" : form.mode}
                              scoring={form.marketing ? <AnswerScoring form={form} q={q} onLabelChange={(id,label)=>updateOption(q.id,id,{label})} marketing={form.marketing} onChange={marketing => setForm(current => ({...current, marketing}))} /> : undefined}
                                  hasLogic={hasLogic}
                                  onSelect={() => setSelectedQuestionId(q.id)}
                                  onMoveQuestion={moveQuestion}
                                  onDuplicateQuestion={duplicateQuestion}
                                  onDeleteQuestion={deleteQuestion}
                                  onUpdateQuestion={updateQuestion}
                                  onUpdateOption={updateOption}
                                  onDeleteOption={deleteOption}
                                  onAddOption={addOption}
                                  onMoveOption={moveOption}
                                />
                              );
                            })}
                          </div>
                        </SortableContext>

                        <DragOverlay
                          dropAnimation={{
                            duration: 200,
                            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                          }}
                        >
                          {activeQuestion ? (
                            <div className="bg-white border-2 border-indigo-500 rounded-xl p-5 shadow-2xl ring-4 ring-indigo-500/10 cursor-grabbing opacity-95 max-w-2xl">
                              <div className="flex items-center gap-2 mb-1.5">
                                <GripVertical className="w-4 h-4 text-indigo-600" />
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                                  Reordering Question
                                </span>
                                <span className="text-xs font-semibold text-gray-900 truncate">
                                  {activeQuestion.title || "Untitled Question"}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 italic pl-6">
                                Release to drop question into new sequence
                              </p>
                            </div>
                          ) : null}
                        </DragOverlay>
                      </DndContext>
                    )}
                  </>
                )}

                {/* VIEW 3: ENDING / RESULTS PAGE CUSTOMIZER */}
                {canvasView === "ending" && (
                  <div className="space-y-6 py-2">
                    <div className="text-center space-y-2 border-b border-gray-100 pb-5">
                      <div className="inline-flex p-3 rounded-full bg-emerald-50 text-emerald-600 mb-1">
                        <Trophy className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Quiz Completion &amp; Outcomes
                      </h3>
                      <p className="text-xs text-gray-500">
                        Configure dynamic screens shown to respondents based on
                        their percentage score.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {form.outcomeTiers.map((tier, idx) => (
                        <div
                          key={tier.id}
                          className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tier.badge ?? ""}
                              onChange={(e) => {
                                const updated = [...form.outcomeTiers];
                                updated[idx].badge = e.target.value;
                                setForm({ ...form, outcomeTiers: updated });
                              }}
                              className="w-28 bg-white border border-gray-200 rounded px-2.5 py-1 text-xs font-semibold"
                              placeholder="Badge"
                            />
                            <input
                              type="text"
                              value={tier.title ?? ""}
                              onChange={(e) => {
                                const updated = [...form.outcomeTiers];
                                updated[idx].title = e.target.value;
                                setForm({ ...form, outcomeTiers: updated });
                              }}
                              className="flex-1 bg-white border border-gray-200 rounded px-2.5 py-1 text-xs font-bold text-gray-900"
                              placeholder="Outcome Title"
                            />
                            <div className="text-xs font-mono text-gray-500">
                              {tier.minScorePercent}% – {tier.maxScorePercent}%
                            </div>
                          </div>
                          <textarea
                            rows={2}
                            value={tier.message ?? ""}
                            onChange={(e) => {
                              const updated = [...form.outcomeTiers];
                              updated[idx].message = e.target.value;
                              setForm({ ...form, outcomeTiers: updated });
                            }}
                            className="w-full bg-white border border-gray-200 rounded p-2 text-xs text-gray-700 outline-none resize-none"
                            placeholder="Outcome explanation..."
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. BOTTOM FLOATING BAR (MATCHING FILLOUT 1:1) */}
            <div className="py-4 flex items-center justify-between w-full max-w-2xl px-2">
              <button
                onClick={() => addQuestion("multiple_choice")}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-gray-500" />
                <span>Add question</span>
              </button>

              {/* Segmented Center Navigation: Cover, Page & Ending */}
              <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-xs">
                <button
                  onClick={() => setCanvasView("cover")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    canvasView === "cover"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <LayoutTemplate className="w-3 h-3 text-indigo-600" />
                  <span>Cover</span>
                </button>

                <button
                  onClick={() => setCanvasView("page")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    canvasView === "page"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <span>
                    {formPages.find((p) => p.id === activePageId)?.title ||
                      "Page 1"}
                  </span>
                </button>

                <button
                  onClick={() => setCanvasView("ending")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    canvasView === "ending"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                  <span>Ending</span>
                </button>
              </div>

              {/* Fillout Logic Button */}
              <button
                onClick={() => setShowLogicModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
              >
                <GitBranch className="w-3.5 h-3.5 text-gray-500" />
                <span>Logic</span>
                {Boolean(form.logicRules?.length) && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                    {form.logicRules?.length}
                  </span>
                )}
              </button>
            </div>
          </main>

          {/* RIGHT COLUMN: FILLOUT PROPERTY INSPECTOR */}
          <aside
            className={`hq-properties w-64 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto p-5 space-y-6 ${mobilePanel === "settings" ? "mobile-open" : ""}`}
          >
            <button
              className="hq-secondary lg:hidden"
              onClick={() => setMobilePanel(null)}
            >
              Close settings
            </button>
            {selectedQuestion ? (
              <div className="space-y-6">
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Question Settings
                  </span>
                  <div className="text-xs text-gray-900 font-semibold truncate">
                    {selectedQuestion.title || "Untitled"}
                  </div>
                </div>

                {/* Field Type Selector (All 51 Fields in 7 Categories) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Field Type (
                    {PALETTE_SECTIONS.reduce(
                      (acc, sec) => acc + sec.items.length,
                      0,
                    )}{" "}
                    Available)
                  </label>
                  <select
                    value={selectedQuestion.type}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      const updates: Partial<Question> = { type: newType };
                      if (displayTypes.has(newType)) {
                        updates.required = false;
                        updates.points = 0;
                      }
                      if (newType === "switch")
                        updates.options = [
                          { id: "true", label: "True", isCorrect: true },
                          { id: "false", label: "False", isCorrect: false },
                        ];
                      if (newType === "like_dislike")
                        updates.options = [
                          { id: "like", label: "Like", isCorrect: true },
                          { id: "dislike", label: "Dislike", isCorrect: false },
                        ];
                      if (newType === "thumbs")
                        updates.options = [
                          { id: "up", label: "Thumbs up", isCorrect: true },
                          {
                            id: "down",
                            label: "Thumbs down",
                            isCorrect: false,
                          },
                        ];

                      if (
                        (newType === "multiple_choice" ||
                          newType === "multiselect" ||
                          newType === "dropdown" ||
                          newType === "checkboxes" ||
                          newType === "segmented") &&
                        (!selectedQuestion.options ||
                          selectedQuestion.options.length === 0)
                      ) {
                        updates.options = [
                          { id: nanoid(4), label: "Option 1", isCorrect: true },
                          {
                            id: nanoid(4),
                            label: "Option 2",
                            isCorrect: false,
                          },
                        ];
                      }
                      if (
                        newType === "picture_choice" ||
                        newType === "image_multiselect"
                      ) {
                        updates.pictureColumns =
                          selectedQuestion.pictureColumns || 3;
                        updates.pictureAspectRatio =
                          selectedQuestion.pictureAspectRatio || "landscape";
                        if (
                          !selectedQuestion.options ||
                          selectedQuestion.options.length === 0
                        ) {
                          updates.options = [
                            {
                              id: nanoid(4),
                              label: "Mountain Sunrise",
                              imageUrl:
                                "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80",
                              isCorrect: true,
                            },
                            {
                              id: nanoid(4),
                              label: "Ocean Horizon",
                              imageUrl:
                                "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
                              isCorrect: false,
                            },
                            {
                              id: nanoid(4),
                              label: "Forest Mist",
                              imageUrl:
                                "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80",
                              isCorrect: false,
                            },
                          ];
                        } else {
                          const fallbackImages = [
                            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80",
                            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
                            "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80",
                          ];
                          updates.options = selectedQuestion.options.map(
                            (opt, i) => ({
                              ...opt,
                              imageUrl:
                                opt.imageUrl ||
                                fallbackImages[i % fallbackImages.length],
                            }),
                          );
                        }
                      }
                      if (
                        (newType === "choice_matrix" ||
                          newType === "matrix_multiselect") &&
                        !selectedQuestion.rows
                      ) {
                        updates.rows = ["Feature A", "Feature B", "Feature C"];
                        updates.columns = ["Basic", "Standard", "Pro"];
                      }
                      if (newType === "ranking" && !selectedQuestion.items) {
                        updates.items = [
                          "First Priority",
                          "Second Priority",
                          "Third Priority",
                        ];
                      }
                      if (
                        newType === "currency" &&
                        !selectedQuestion.currencySymbol
                      ) {
                        updates.currencySymbol = "$";
                      }
                      if (newType === "terms" && !selectedQuestion.termsText) {
                        updates.termsText =
                          "I agree to the Terms of Service and Privacy Policy";
                        updates.termsUrl = "https://example.com/terms";
                      }
                      if (
                        newType === "video_embed" &&
                        !selectedQuestion.videoUrl
                      ) {
                        updates.videoUrl =
                          "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
                        updates.points = 0;
                      }
                      if (
                        newType === "image_display" &&
                        !selectedQuestion.mediaUrl
                      ) {
                        updates.mediaUrl =
                          "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80";
                        updates.points = 0;
                      }
                      if (
                        newType === "rich_text" &&
                        !selectedQuestion.richTextContent
                      ) {
                        updates.richTextContent =
                          "### Background & Instructions\nProvide detailed text, guidelines, or resources here.";
                        updates.points = 0;
                      }
                      if (
                        newType === "accordion" &&
                        !selectedQuestion.accordionItems
                      ) {
                        updates.accordionItems = [
                          {
                            id: nanoid(4),
                            title: "What are the rules?",
                            content:
                              "Please read each question carefully before submitting.",
                          },
                          {
                            id: nanoid(4),
                            title: "How is score computed?",
                            content:
                              "Points are tallied automatically upon completion.",
                          },
                        ];
                        updates.points = 0;
                      }
                      if (
                        newType === "calculation" &&
                        !selectedQuestion.calculationFormula
                      ) {
                        updates.calculationFormula =
                          "[Total Score] = Sum of points";
                        updates.points = 0;
                      }
                      if (
                        newType === "hidden" &&
                        !selectedQuestion.hiddenParamName
                      ) {
                        updates.hiddenParamName = "utm_source";
                        updates.points = 0;
                      }
                      if (
                        newType === "scheduler" &&
                        !selectedQuestion.timeSlots
                      ) {
                        updates.timeSlots = [
                          "09:00 AM",
                          "10:30 AM",
                          "01:00 PM",
                          "03:30 PM",
                        ];
                      }
                      if (newType === "image_upload") {
                        updates.maxFiles = selectedQuestion.maxFiles || 1;
                        updates.maxFileSizeMB =
                          selectedQuestion.maxFileSizeMB || 10;
                      }
                      if (newType === "like_dislike") {
                        updates.options = [
                          { id: "like", label: "Like", isCorrect: true },
                          { id: "dislike", label: "Dislike", isCorrect: false },
                        ];
                      }
                      updateQuestion(selectedQuestion.id, updates);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none"
                  >
                    <optgroup label="Text & Contact (10)">
                      <option value="short_answer">Short answer</option>
                      <option value="paragraph">Paragraph</option>
                      <option value="email">Email address</option>
                      <option value="phone">Phone number</option>
                      <option value="full_name">Full name</option>
                      <option value="address">Address</option>
                      <option value="website">Website URL</option>
                      <option value="number">Number</option>
                      <option value="currency">Currency</option>
                      <option value="password">Password</option>
                    </optgroup>
                    <optgroup label="Choices & Selection (13)">
                      <option value="multiple_choice">Multiple choice</option>
                      <option value="multiselect">Multiselect</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="picture_choice">
                        Picture choice (Single)
                      </option>
                      <option value="image_multiselect">
                        Image multi-select
                      </option>
                      <option value="segmented">Segmented control</option>
                      <option value="switch">Switch (True/False)</option>
                      <option value="checkbox">Single checkbox</option>
                      <option value="checkboxes">Checkboxes list</option>
                      <option value="terms">Terms & Conditions</option>
                      <option value="choice_matrix">
                        Choice matrix (Single)
                      </option>
                      <option value="matrix_multiselect">
                        Matrix multi-select
                      </option>
                      <option value="ranking">Ranking</option>
                    </optgroup>
                    <optgroup label="Ratings & Feedback (8)">
                      <option value="rating">Rating (Stars)</option>
                      <option value="opinion_scale">Opinion scale</option>
                      <option value="nps">NPS Score (0-10)</option>
                      <option value="slider">Slider</option>
                      <option value="emoji_rating">Emoji rating</option>
                      <option value="thumbs">Thumbs Up / Down</option>
                      <option value="like_dislike">Like / Dislike</option>
                      <option value="audio_recorder">
                        Voice note recorder
                      </option>
                    </optgroup>
                    <optgroup label="Date, Time & Scheduling (5)">
                      <option value="date">Date picker</option>
                      <option value="time">Time picker</option>
                      <option value="datetime">Date & Time</option>
                      <option value="date_range">Date range</option>
                      <option value="scheduler">Meeting preference</option>
                    </optgroup>
                    <optgroup label="Media & Signatures (5)">
                      <option value="file_upload">File upload</option>
                      <option value="image_upload">Image upload</option>
                      <option value="signature">Typed signature</option>
                      <option value="color_picker">Color picker</option>
                      <option value="video_embed">Video embed</option>
                    </optgroup>
                    <optgroup label="Display & Layout (7)">
                      <option value="heading">Heading (H1)</option>
                      <option value="subheading">Subheading</option>
                      <option value="banner">Banner callout</option>
                      <option value="divider">Divider line</option>
                      <option value="image_display">Image figure</option>
                      <option value="rich_text">Rich text block</option>
                      <option value="accordion">Accordion FAQ</option>
                    </optgroup>
                    <optgroup label="Advanced & Logic (3)">
                      <option value="calculation">Calculation formula</option>
                      <option value="hidden">Hidden variable</option>
                      <option value="captcha">CAPTCHA challenge</option>
                    </optgroup>
                  </select>
                </div>

                {/* Assigned Page Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center justify-between">
                    <span>Assigned Page</span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Page{" "}
                      {formPages.findIndex(
                        (p) =>
                          p.id === (selectedQuestion.pageId || formPages[0].id),
                      ) + 1}
                    </span>
                  </label>
                  <select
                    value={
                      selectedQuestion.pageId || formPages[0]?.id || "page-1"
                    }
                    onChange={(e) =>
                      updateQuestion(selectedQuestion.id, {
                        pageId: e.target.value,
                      })
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none"
                  >
                    {formPages.map((p, idx) => (
                      <option key={p.id} value={p.id}>
                        Page {idx + 1}: {p.title || `Page ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Currency Symbol Customizer */}
                {selectedQuestion.type === "currency" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Currency Symbol
                    </label>
                    <div className="flex gap-2">
                      {["$", "€", "£", "¥", "CAD"].map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() =>
                            updateQuestion(selectedQuestion.id, {
                              currencySymbol: sym,
                            })
                          }
                          className={`flex-1 py-1 rounded border text-xs font-bold transition ${
                            (selectedQuestion.currencySymbol || "$") === sym
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Picture Choice Layout & Aspect Ratio Customizer */}
                {selectedQuestion.type === "picture_choice" && (
                  <div className="space-y-3.5 p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                        <span>Grid Columns</span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {selectedQuestion.pictureColumns || 3} Columns
                        </span>
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[2, 3, 4].map((cols) => (
                          <button
                            key={cols}
                            type="button"
                            onClick={() =>
                              updateQuestion(selectedQuestion.id, {
                                pictureColumns: cols,
                              })
                            }
                            className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                              (selectedQuestion.pictureColumns || 3) === cols
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            {cols} Cols
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                        <span>Card Aspect Ratio</span>
                        <span className="text-[10px] text-gray-500 capitalize">
                          {selectedQuestion.pictureAspectRatio || "landscape"}
                        </span>
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "landscape", label: "16:9", sub: "Landscape" },
                          { id: "square", label: "1:1", sub: "Square" },
                          { id: "portrait", label: "3:4", sub: "Portrait" },
                        ].map((ratio) => (
                          <button
                            key={ratio.id}
                            type="button"
                            onClick={() =>
                              updateQuestion(selectedQuestion.id, {
                                pictureAspectRatio: ratio.id as
                                  | "square"
                                  | "landscape"
                                  | "portrait",
                              })
                            }
                            className={`py-1.5 px-1 flex flex-col items-center justify-center text-xs rounded-lg border transition ${
                              (selectedQuestion.pictureAspectRatio ||
                                "landscape") === ratio.id
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            <span className="font-bold">{ratio.label}</span>
                            <span className="text-[10px] opacity-80">
                              {ratio.sub}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Terms & Conditions Config */}
                {selectedQuestion.type === "terms" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Terms Text
                      </label>
                      <input
                        type="text"
                        value={selectedQuestion.termsText || ""}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            termsText: e.target.value,
                          })
                        }
                        placeholder="I agree to terms..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Terms Link URL
                      </label>
                      <input
                        type="text"
                        value={selectedQuestion.termsUrl || ""}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            termsUrl: e.target.value,
                          })
                        }
                        placeholder="https://example.com/terms"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Subheading Config */}
                {selectedQuestion.type === "subheading" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Subheading Content
                    </label>
                    <textarea
                      rows={3}
                      value={selectedQuestion.subheadingText || ""}
                      onChange={(e) =>
                        updateQuestion(selectedQuestion.id, {
                          subheadingText: e.target.value,
                        })
                      }
                      placeholder="Enter secondary instructions or subtitle..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none resize-none"
                    />
                  </div>
                )}

                {/* Choice Matrix Rows & Columns Editor */}
                {selectedQuestion.type === "choice_matrix" && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-600">
                          Rows (Criteria)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const currentRows = selectedQuestion.rows || [];
                            updateQuestion(selectedQuestion.id, {
                              rows: [
                                ...currentRows,
                                `Criteria ${currentRows.length + 1}`,
                              ],
                            });
                          }}
                          className="text-[11px] text-indigo-600 font-semibold hover:underline"
                        >
                          + Add Row
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {(selectedQuestion.rows || []).map((row, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-1">
                            <input
                              type="text"
                              value={row}
                              onChange={(e) => {
                                const newRows = [
                                  ...(selectedQuestion.rows || []),
                                ];
                                newRows[rIdx] = e.target.value;
                                updateQuestion(selectedQuestion.id, {
                                  rows: newRows,
                                });
                              }}
                              className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newRows = (
                                  selectedQuestion.rows || []
                                ).filter((_, i) => i !== rIdx);
                                updateQuestion(selectedQuestion.id, {
                                  rows: newRows,
                                });
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-600">
                          Columns (Scale)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const currentCols = selectedQuestion.columns || [];
                            updateQuestion(selectedQuestion.id, {
                              columns: [
                                ...currentCols,
                                `Scale ${currentCols.length + 1}`,
                              ],
                            });
                          }}
                          className="text-[11px] text-indigo-600 font-semibold hover:underline"
                        >
                          + Add Col
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {(selectedQuestion.columns || []).map((col, cIdx) => (
                          <div key={cIdx} className="flex items-center gap-1">
                            <input
                              type="text"
                              value={col}
                              onChange={(e) => {
                                const newCols = [
                                  ...(selectedQuestion.columns || []),
                                ];
                                newCols[cIdx] = e.target.value;
                                updateQuestion(selectedQuestion.id, {
                                  columns: newCols,
                                });
                              }}
                              className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newCols = (
                                  selectedQuestion.columns || []
                                ).filter((_, i) => i !== cIdx);
                                updateQuestion(selectedQuestion.id, {
                                  columns: newCols,
                                });
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ranking Items Editor */}
                {selectedQuestion.type === "ranking" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-600">
                        Rank Items
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const items = selectedQuestion.items || [];
                          updateQuestion(selectedQuestion.id, {
                            items: [...items, `Item ${items.length + 1}`],
                          });
                        }}
                        className="text-[11px] text-indigo-600 font-semibold hover:underline"
                      >
                        + Add Item
                      </button>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {(selectedQuestion.items || []).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 font-mono w-4">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const newItems = [
                                ...(selectedQuestion.items || []),
                              ];
                              newItems[idx] = e.target.value;
                              updateQuestion(selectedQuestion.id, {
                                items: newItems,
                              });
                            }}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = (
                                selectedQuestion.items || []
                              ).filter((_, i) => i !== idx);
                              updateQuestion(selectedQuestion.id, {
                                items: newItems,
                              });
                            }}
                            className="p-1 text-gray-400 hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Slider Settings */}
                {selectedQuestion.type === "slider" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">
                        Min
                      </label>
                      <input
                        type="number"
                        value={selectedQuestion.minVal ?? 0}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            minVal: Number(e.target.value),
                          })
                        }
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">
                        Max
                      </label>
                      <input
                        type="number"
                        value={selectedQuestion.maxVal ?? 100}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            maxVal: Number(e.target.value),
                          })
                        }
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">
                        Step
                      </label>
                      <input
                        type="number"
                        value={selectedQuestion.stepVal ?? 1}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            stepVal: Number(e.target.value),
                          })
                        }
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Points Value */}
                {form.mode === "quiz" && !form.marketing &&
                  selectedQuestion.type !== "heading" &&
                  selectedQuestion.type !== "subheading" &&
                  selectedQuestion.type !== "banner" &&
                  selectedQuestion.type !== "divider" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Points for a correct answer
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={selectedQuestion.points ?? 10}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            points: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 font-mono outline-none"
                      />
                    </div>
                  )}

                {/* Placeholder text customization */}
                {(selectedQuestion.type === "short_answer" ||
                  selectedQuestion.type === "paragraph" ||
                  selectedQuestion.type === "email" ||
                  selectedQuestion.type === "phone" ||
                  selectedQuestion.type === "number" ||
                  selectedQuestion.type === "website" ||
                  selectedQuestion.type === "password" ||
                  selectedQuestion.type === "checkbox") && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Placeholder Hint
                    </label>
                    <input
                      type="text"
                      value={selectedQuestion.placeholder || ""}
                      onChange={(e) =>
                        updateQuestion(selectedQuestion.id, {
                          placeholder: e.target.value,
                        })
                      }
                      placeholder="e.g. Type your response..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none"
                    />
                  </div>
                )}

                {/* Video Embed Settings */}
                {selectedQuestion.type === "video_embed" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Video URL (YouTube or Direct Embed)
                    </label>
                    <input
                      type="url"
                      value={selectedQuestion.videoUrl || ""}
                      onChange={(e) =>
                        updateQuestion(selectedQuestion.id, {
                          videoUrl: e.target.value,
                        })
                      }
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none font-mono"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Supports YouTube, Vimeo, and MP4 links
                    </span>
                  </div>
                )}

                {/* Image Display Settings */}
                {selectedQuestion.type === "image_display" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Image Display URL
                    </label>
                    <input
                      type="url"
                      value={selectedQuestion.mediaUrl || ""}
                      onChange={(e) =>
                        updateQuestion(selectedQuestion.id, {
                          mediaUrl: e.target.value,
                        })
                      }
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none font-mono"
                    />
                  </div>
                )}

                {/* Rich Text Block Settings */}
                {selectedQuestion.type === "rich_text" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Rich Text Markdown Content
                    </label>
                    <textarea
                      rows={6}
                      value={selectedQuestion.richTextContent || ""}
                      onChange={(e) =>
                        updateQuestion(selectedQuestion.id, {
                          richTextContent: e.target.value,
                        })
                      }
                      placeholder="Write instructions, markdown headings, bullets, or links..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none resize-none font-mono"
                    />
                  </div>
                )}

                {/* Accordion FAQ Items Settings */}
                {selectedQuestion.type === "accordion" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-600">
                        Accordion Items
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const items = selectedQuestion.accordionItems || [];
                          updateQuestion(selectedQuestion.id, {
                            accordionItems: [
                              ...items,
                              {
                                id: nanoid(4),
                                title: `Question ${items.length + 1}`,
                                content: "Details and guidance...",
                              },
                            ],
                          });
                        }}
                        className="text-[11px] text-indigo-600 font-semibold hover:underline"
                      >
                        + Add Item
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(selectedQuestion.accordionItems || []).map(
                        (item, itemIdx) => (
                          <div
                            key={item.id}
                            className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => {
                                  const items = [
                                    ...(selectedQuestion.accordionItems || []),
                                  ];
                                  items[itemIdx].title = e.target.value;
                                  updateQuestion(selectedQuestion.id, {
                                    accordionItems: items,
                                  });
                                }}
                                placeholder="Accordion Title"
                                className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs font-semibold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const items = (
                                    selectedQuestion.accordionItems || []
                                  ).filter((_, i) => i !== itemIdx);
                                  updateQuestion(selectedQuestion.id, {
                                    accordionItems: items,
                                  });
                                }}
                                className="p-1 text-gray-400 hover:text-rose-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <textarea
                              rows={2}
                              value={item.content}
                              onChange={(e) => {
                                const items = [
                                  ...(selectedQuestion.accordionItems || []),
                                ];
                                items[itemIdx].content = e.target.value;
                                updateQuestion(selectedQuestion.id, {
                                  accordionItems: items,
                                });
                              }}
                              placeholder="Content / explanation..."
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs outline-none resize-none"
                            />
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Calculation Formula Settings */}
                {selectedQuestion.type === "calculation" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Calculation Expression / Formula
                    </label>
                    <input
                      type="text"
                      value={selectedQuestion.calculationFormula || ""}
                      onChange={(e) =>
                        updateQuestion(selectedQuestion.id, {
                          calculationFormula: e.target.value,
                        })
                      }
                      placeholder="{{question-id}} * 2"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none font-mono"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Live computed value shown during evaluation
                    </span>
                  </div>
                )}

                {/* Hidden Param Variable Settings */}
                {selectedQuestion.type === "hidden" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      URL Query Parameter Key
                    </label>
                    <input
                      type="text"
                      value={selectedQuestion.hiddenParamName || ""}
                      onChange={(e) =>
                        updateQuestion(selectedQuestion.id, {
                          hiddenParamName: e.target.value,
                        })
                      }
                      placeholder="e.g. utm_source, ref_id"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none font-mono"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Captures `?utm_source=...` automatically from player URL
                    </span>
                  </div>
                )}

                {/* Scheduler Time Slots Settings */}
                {selectedQuestion.type === "scheduler" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-600">
                        Available Time Slots
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const slots = selectedQuestion.timeSlots || [];
                          updateQuestion(selectedQuestion.id, {
                            timeSlots: [...slots, "04:00 PM"],
                          });
                        }}
                        className="text-[11px] text-indigo-600 font-semibold hover:underline"
                      >
                        + Add Slot
                      </button>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {(selectedQuestion.timeSlots || []).map((slot, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={slot}
                            onChange={(e) => {
                              const newSlots = [
                                ...(selectedQuestion.timeSlots || []),
                              ];
                              newSlots[sIdx] = e.target.value;
                              updateQuestion(selectedQuestion.id, {
                                timeSlots: newSlots,
                              });
                            }}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newSlots = (
                                selectedQuestion.timeSlots || []
                              ).filter((_, i) => i !== sIdx);
                              updateQuestion(selectedQuestion.id, {
                                timeSlots: newSlots,
                              });
                            }}
                            className="p-1 text-gray-400 hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image Upload Limits */}
                {selectedQuestion.type === "image_upload" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">
                        Images per answer (1)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1}
                        disabled
                        value={1}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            maxFiles: Number(e.target.value),
                          })
                        }
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">
                        Max MB
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={selectedQuestion.maxFileSizeMB ?? 10}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            maxFileSizeMB: Number(e.target.value),
                          })
                        }
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Toggles */}
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                    <span>Required Field</span>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedQuestion.required)}
                      onChange={(e) =>
                        updateQuestion(selectedQuestion.id, {
                          required: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                    />
                  </label>

                  {(selectedQuestion.type === "multiple_choice" ||
                    selectedQuestion.type === "multiselect" ||
                    selectedQuestion.type === "dropdown" ||
                    selectedQuestion.type === "picture_choice" ||
                    selectedQuestion.type === "image_multiselect" ||
                    selectedQuestion.type === "checkboxes") && (
                    <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                      <span>Randomize Choices</span>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedQuestion.shuffleOptions)}
                        onChange={(e) =>
                          updateQuestion(selectedQuestion.id, {
                            shuffleOptions: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                      />
                    </label>
                  )}
                </div>
              </div>
            ) : (
              /* Form & Multi-Page Settings Panel (when no question is specifically selected) */
              <div className="space-y-5">
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Multi-Page &amp; Form Settings
                  </span>
                  <p className="text-xs text-gray-500">
                    Configure global flow and player navigation styles.
                  </p>
                </div>

                {/* Progress Bar Style */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Progress Indicator Style
                  </label>
                  <select
                    value={form.settings?.progressBarMode || "percentage"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        settings: {
                          ...form.settings,
                          progressBarMode: e.target.value as NonNullable<
                            FormSchemaType["settings"]["progressBarMode"]
                          >,
                          showProgressBar: e.target.value !== "none",
                        },
                      })
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none"
                  >
                    <option value="percentage">
                      Percentage Bar (Continuous)
                    </option>
                    <option value="steps">Step count</option>
                    <option value="pages">Page count</option>
                    <option value="questions">Question count</option>
                    <option value="none">Hidden (No progress indicator)</option>
                  </select>
                </div>

                {/* Page Navigation Toggles */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                    <div>
                      <span className="font-medium block">
                        Clickable Page Jumps
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Allow users to jump between pages directly
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(form.settings?.enablePageJumps ?? true)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          settings: {
                            ...form.settings,
                            enablePageJumps: e.target.checked,
                          },
                        })
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                    <div>
                      <span className="font-medium block">
                        Pre-Submit Review Screen
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Show summary of all answers before final submit
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(form.settings?.showReviewBeforeSubmit)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          settings: {
                            ...form.settings,
                            showReviewBeforeSubmit: e.target.checked,
                          },
                        })
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                    <div>
                      <span className="font-medium block">Feedback Mode</span>
                      <span className="text-[10px] text-gray-400">
                        Show explanations immediately or on finish
                      </span>
                    </div>
                    <select
                      value={form.settings?.feedbackMode || "end"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          settings: {
                            ...form.settings,
                            feedbackMode: e.target.value as "immediate" | "end",
                          },
                        })
                      }
                      className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs"
                    >
                      <option value="end">On Quiz Finish</option>
                      <option value="immediate">Immediate Feedback</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                    <div>
                      <span className="font-medium block">Passing Score %</span>
                      <span className="text-[10px] text-gray-400">
                        Threshold required for passing badge
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.settings?.passingScorePercentage ?? 70}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          settings: {
                            ...form.settings,
                            passingScorePercentage: Number(e.target.value),
                          },
                        })
                      }
                      className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-right"
                    />
                  </label>
                </div>

                {/* Cover Page Quick Toggle */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-gray-800 block">
                      Cover Screen
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Welcome hero before questions
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCanvasView("cover")}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-indigo-600 text-xs font-semibold cursor-pointer"
                  >
                    Edit Cover →
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* RESULTS & ANALYTICS TAB */}
      {activeNavTab === "contacts" && <ContactsStudio form={form} onChange={setForm} />}
      {activeNavTab === "marketing" && (
        <MarketingStudio form={form} onChange={setForm} />
      )}
      {activeNavTab === "results" && (
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6 sm:p-10 font-sans">
          <div className="max-w-6xl w-full mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                    Submissions &amp; Analytics
                  </h2>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Conversion performance, score distributions, and
                  detailed respondent records.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={fetchSubmissions}
                  disabled={isLoadingSubmissions}
                  className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  title="Refresh responses"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingSubmissions ? "animate-spin text-indigo-600" : "text-gray-500"}`}
                  />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={submissions.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  <span>Export CSV</span>
                </button>

                <Link
                  onClick={guest ? (e) => { e.preventDefault(); void saveNow(); } : undefined}
            href={guest ? "/create" : `/play/${form.id}?preview=1`}
                  target="_blank"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Quiz</span>
                </Link>
              </div>
            </div>

            <ResultsChart formId={form.id} refreshKey={submissions} />
            <TrackingStudio form={form} onChange={setForm} />
            <h3 className="text-sm font-semibold text-slate-500">All-time response records</h3>
            {/* Metric Cards Grid */}
            {form.marketing ? (
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  ["Responses", submissions.length],
                  [
                    "Recommendations",
                    submissions.filter((s) => s.marketing?.status === "matched")
                      .length,
                  ],
                  [
                    "Scorecards",
                    submissions.filter((s) => s.marketing?.kind === "scorecard")
                      .length,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="bg-white rounded-2xl border border-slate-200 p-5"
                  >
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="text-3xl font-semibold mt-2">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Total Submissions
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 font-mono">
                    {submissionStats.total}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Total completed responses
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Average Score
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-indigo-600 font-mono">
                    {submissionStats.averageScore}%
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {submissionStats.passedCount} passed /{" "}
                    {submissionStats.failedCount} review
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Pass Rate
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 font-mono">
                    {submissionStats.passRate}%
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Passing mark: {form.settings.passingScorePercentage ?? 70}%
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Questions Tested
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Trophy className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 font-mono">
                    {
                      form.questions.filter(
                        (q) => q.type !== "heading" && q.type !== "banner",
                      ).length
                    }
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {totalPoints} total points possible
                  </p>
                </div>
              </div>
            )}

            {/* Outcome Tier Distribution */}
            {form.outcomeTiers.length > 0 && (
              <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-800 uppercase tracking-wider">
                    Outcome Tier Distribution
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {submissions.length} total respondent
                    {submissions.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {form.outcomeTiers.map((tier) => {
                    const count = submissions.filter(
                      (s) => s.matchedTier?.id === tier.id,
                    ).length;
                    const pct =
                      submissions.length > 0
                        ? Math.round((count / submissions.length) * 100)
                        : 0;
                    return (
                      <div
                        key={tier.id}
                        className="p-3 rounded-xl border border-gray-100 bg-gray-50/70 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <span>{tier.badge}</span>
                            <span className="truncate max-w-[140px]">
                              {tier.title}
                            </span>
                          </span>
                          <span className="text-xs font-mono font-bold text-indigo-600">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 block">
                          Score band: {tier.minScorePercent}% –{" "}
                          {tier.maxScorePercent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submissions Table Card */}
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
              {/* Search & Filter Bar */}
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by ID, score, or tier..."
                    value={submissionSearch}
                    onChange={(e) => setSubmissionSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-800 outline-none transition"
                  />
                </div>

                <div className="text-xs text-gray-400 font-mono">
                  Showing {filteredSubmissions.length} of {submissions.length}{" "}
                  submission{submissions.length === 1 ? "" : "s"}
                </div>
              </div>

              {/* Table or Empty State */}
              {submissions.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">
                      No submissions recorded yet
                    </h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                      As soon as users complete your quiz in the player, their
                      answers, grading breakdown, and timestamps will appear
                      here.
                    </p>
                  </div>
                  <Link
                    onClick={guest ? (e) => { e.preventDefault(); void saveNow(); } : undefined}
            href={guest ? "/create" : `/play/${form.id}?preview=1`}
                    target="_blank"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Submit a test response</span>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/80 text-gray-600 border-b border-gray-200 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Submitted At</th>
                        <th className="py-3 px-4">Score</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Result</th>
                        {form.questions.slice(0, 3).map((q, idx) => (
                          <th
                            key={q.id}
                            className="py-3 px-4 max-w-[150px] truncate"
                            title={q.title}
                          >
                            Q{idx + 1}: {q.title}
                          </th>
                        ))}
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSubmissions.map((sub, idx) => {
                        return (
                          <tr
                            key={sub.id || idx}
                            onClick={() => setSelectedSubmission(sub)}
                            className="hover:bg-gray-50/80 transition cursor-pointer group"
                          >
                            <td className="py-3.5 px-4 font-mono text-gray-400">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-gray-800 whitespace-nowrap">
                              {new Date(sub.submittedAt).toLocaleString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                              <span className="text-sm">
                                {sub.marketing
                                  ? "—"
                                  : `${sub.percentageScore}%`}
                              </span>
                              <span className="text-[10px] text-gray-400 font-normal ml-1">
                                {!sub.marketing &&
                                  `(${sub.totalPointsEarned}/${sub.totalPointsPossible} pts)`}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  sub.passed
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {sub.passed ? (
                                  <Check className="w-3 h-3 stroke-[3]" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                                {sub.marketing
                                  ? "Recorded"
                                  : sub.passed
                                    ? "Passed"
                                    : "Needs Review"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {sub.marketing ? (
                                <span className="text-sm text-indigo-700">
                                  {sub.marketing.title}
                                </span>
                              ) : sub.matchedTier ? (
                                <span className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
                                  <span>{sub.matchedTier.badge}</span>
                                  <span className="truncate max-w-[140px]">
                                    {sub.matchedTier.title}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            {form.questions.slice(0, 3).map((q) => {
                              const grading = sub.grading?.find(
                                (g) => g.questionId === q.id,
                              );
                              return (
                                <td
                                  key={q.id}
                                  className="py-3.5 px-4 max-w-[150px] truncate text-gray-600"
                                >
                                  {grading ? (
                                    <span className="flex items-center gap-1">
                                      {grading.isCorrect ? (
                                        <Check className="w-3 h-3 text-emerald-600 shrink-0 stroke-[3]" />
                                      ) : (
                                        <X className="w-3 h-3 text-rose-500 shrink-0 stroke-[2.5]" />
                                      )}
                                      <span className="truncate">
                                        {String(grading.userAnswer || "—")}
                                      </span>
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              );
                            })}
                            <td
                              className="py-3.5 px-4 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedSubmission(sub)}
                                  className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                                <button
                                  onClick={() =>
                                    sub.id && handleDeleteSubmission(sub.id)
                                  }
                                  className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Delete response"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SHARE TAB */}
      {activeNavTab === "share" && (
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6 sm:p-10 font-sans">
          <div className="max-w-3xl w-full mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                    Share Your Quiz
                  </h2>
                  <p className="text-xs text-gray-500">
                    Distribute your form with a direct link or embed it into
                    your website.
                  </p>
                </div>
              </div>

              {!isPublished ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                  <h3 className="font-semibold text-gray-900">Publish your quiz to get a working share link</h3>
                  <p className="text-sm text-gray-700">Saved means your draft is stored in your account. It is not public yet. Publishing makes it available to visitors and enables embedding.</p>
                  <div className="flex flex-wrap gap-3">
                    <button disabled={publishing} onClick={() => void handlePublish()} className="hq-primary disabled:opacity-50">{publishing ? "Publishing…" : "Publish and enable sharing"}</button>
                    <a href={`/play/${form.id}?preview=1`} target="_blank" rel="noopener noreferrer" className="hq-secondary">Preview privately</a>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-emerald-700">{liveFingerprint !== publicationFingerprint(form) ? "Your link shows the previous published version. Publish again to make these edits live." : "Published · Your public link is ready."}</p>
              {/* Direct Link Box */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-gray-700">
                  Direct Player URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      typeof window !== "undefined"
                        ? `${window.location.origin}/play/${form.id}`
                        : `/play/${form.id}`
                    }
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-800 outline-none"
                  />
                  <button
                    onClick={copyShareLink}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{shareCopied ? "Copied!" : "Copy Link"}</span>
                  </button>
                  <Link
                    href={`/play/${form.id}`}
                    target="_blank"
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Embed Code Snippet */}
              <div className="space-y-1.5 pt-3 border-t border-gray-100">
                <label className="text-xs font-semibold text-gray-700">
                  Responsive IFrame Embed
                </label>
                <div className="relative">
                  <textarea
                    readOnly
                    rows={2}
                    value={`<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/play/${form.id}" width="100%" height="700px" frameborder="0"></iframe>`}
                    className="w-full bg-gray-900 text-emerald-400 font-mono text-xs p-3 rounded-xl resize-none outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `<iframe src="${window.location.origin}/play/${form.id}" width="100%" height="700px" frameborder="0"></iframe>`,
                      );
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    }}
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Code</span>
                  </button>
                </div>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeNavTab === "integrate" && (
        <div className="flex-1 overflow-auto">
          <IntegrationStudio form={form} />
        </div>
      )}

      {/* SUBMISSION DETAIL MODAL */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Submission Details
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    {new Date(selectedSubmission.submittedAt).toLocaleString()}{" "}
                    • ID: {selectedSubmission.id || "N/A"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score & Tier Header */}
            {!selectedSubmission.marketing && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Outcome Tier
                  </span>
                  <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mt-0.5">
                    <span>{selectedSubmission.matchedTier?.badge || "🎯"}</span>
                    <span>
                      {selectedSubmission.matchedTier?.title || "Completed"}
                    </span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Total Score
                  </span>
                  <span className="text-xl font-mono font-black text-indigo-600">
                    {selectedSubmission.percentageScore}%
                  </span>
                  <span className="text-xs text-gray-400 font-mono ml-1">
                    ({selectedSubmission.totalPointsEarned}/
                    {selectedSubmission.totalPointsPossible} pts)
                  </span>
                </div>
              </div>
            )}

            {/* Question Breakdown List */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              {selectedSubmission.marketing && (
                <div className="mb-6 border-b border-slate-200 pb-6">
                  <MarketingResultCard result={selectedSubmission.marketing} />
                </div>
              )}
              {selectedSubmission.grading?.map((g, idx) => (
                <div
                  key={g.questionId || idx}
                  className={`p-4 rounded-xl border transition ${
                    g.isCorrect
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-gray-200 bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">
                      Q{idx + 1}: {g.questionTitle}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        g.isCorrect
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {g.earnedPoints} / {g.maxPoints} pts
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-gray-700">
                    <p>
                      <span className="font-semibold text-gray-500">
                        User Answer:{" "}
                      </span>
                      <span
                        className={
                          g.isCorrect
                            ? "text-emerald-700 font-semibold"
                            : "text-rose-600 font-semibold"
                        }
                      >
                        {String(g.userAnswer ?? "(No answer)")}
                        {typeof record(
                          selectedSubmission.answers?.[g.questionId],
                        ).id === "string" && (
                          <a
                            className="block mt-2 text-indigo-600 underline"
                            href={`/api/media/${String(record(selectedSubmission.answers?.[g.questionId]).id)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download attachment
                          </a>
                        )}
                      </span>
                    </p>
                    {!g.isCorrect && g.correctAnswer && (
                      <p>
                        <span className="font-semibold text-gray-500">
                          Correct Answer:{" "}
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          {String(g.correctAnswer)}
                        </span>
                      </p>
                    )}
                    {g.explanation && (
                      <p className="text-gray-500 text-[11px] pt-1 border-t border-gray-200/50 mt-1">
                        💡 {g.explanation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium text-xs rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AGENT STUDIO MODAL */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">
                    AI Agent Quiz Creator
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    The agent generates questions, answer keys, points, and
                    explanations into your canvas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAgentModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  What topic should this quiz cover?
                </label>
                <textarea
                  rows={3}
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  placeholder="e.g. Modern React 19 hooks, Docker container security, or Customer NPS Survey..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 outline-none resize-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Question Count
                  </label>
                  <select
                    value={agentNumQuestions}
                    onChange={(e) =>
                      setAgentNumQuestions(Number(e.target.value))
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none"
                  >
                    <option value={3}>3 Questions</option>
                    <option value={5}>5 Questions</option>
                    <option value={8}>8 Questions</option>
                    <option value={10}>10 Questions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={agentDifficulty}
                    onChange={(e) =>
                      setAgentDifficulty(
                        e.target.value as
                          | "beginner"
                          | "intermediate"
                          | "advanced",
                      )
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-900 outline-none"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAgentGenerate}
                disabled={isAgentGenerating || !agentPrompt.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isAgentGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Agent is generating quiz...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generate Quiz & Load into Canvas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      </>}
      {showThemeModal && (
        <ThemeEditor theme={form.theme} onClose={() => setShowThemeModal(false)}
          onApply={(theme) => { setForm(current => ({ ...current, theme })); setShowThemeModal(false); }} />
      )}

      {/* LOGIC & BRANCHING MODAL */}
      {showLogicModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <GitBranch className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Conditional Logic &amp; Branching
                  </h3>
                  <p className="text-xs text-gray-500">
                    Route respondents dynamically or show/hide questions based
                    on answers
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddLogicRule}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Rule</span>
                </button>
                <button
                  onClick={() => setShowLogicModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {logicRules.length === 0 ? (
                <div className="py-12 px-6 text-center border-2 border-dashed border-gray-200 rounded-xl space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                    <GitBranch className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">
                      No logic rules configured
                    </h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                      Add conditional branching to skip irrelevant questions,
                      jump to specific ending screens, or personalize the path.
                    </p>
                  </div>
                  <button
                    onClick={handleAddLogicRule}
                    className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create your first rule</span>
                  </button>
                </div>
              ) : (
                logicRules.map((rule, idx) => {
                  const sourceQ = form.questions.find(
                    (q) => q.id === rule.sourceQuestionId,
                  );
                  const isAnsweredOperator =
                    rule.operator === "is_answered" ||
                    rule.operator === "is_not_answered";
                  const hasOptions =
                    sourceQ?.options && sourceQ.options.length > 0;

                  return (
                    <div
                      key={rule.id}
                      className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 hover:border-gray-300 transition space-y-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-gray-200/80 text-gray-700 uppercase">
                          Rule #{idx + 1}
                        </span>
                        <button
                          onClick={() => handleRemoveLogicRule(rule.id)}
                          className="text-gray-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Delete rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* IF CLAUSE */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-800 font-bold shrink-0">
                          IF
                        </span>

                        {/* Source Question */}
                        <select
                          value={rule.sourceQuestionId}
                          onChange={(e) => {
                            const newSourceId = e.target.value;
                            const newQ = form.questions.find(
                              (q) => q.id === newSourceId,
                            );
                            handleUpdateLogicRule(rule.id, {
                              sourceQuestionId: newSourceId,
                              value: newQ?.options?.[0]?.label || "",
                            });
                          }}
                          className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[220px] truncate"
                        >
                          {form.questions.map((q, qIdx) => (
                            <option key={q.id} value={q.id}>
                              Q{qIdx + 1}: {q.title || "Untitled Question"}
                            </option>
                          ))}
                        </select>

                        {/* Operator */}
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            handleUpdateLogicRule(rule.id, {
                              operator: e.target.value as LogicOperator,
                            })
                          }
                          className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="equals">is equal to</option>
                          <option value="not_equals">is not equal to</option>
                          <option value="contains">contains</option>
                          <option value="greater_than">
                            is greater than (&gt;)
                          </option>
                          <option value="less_than">is less than (&lt;)</option>
                          <option value="is_answered">is answered</option>
                          <option value="is_not_answered">is unanswered</option>
                        </select>

                        {/* Value Input */}
                        {!isAnsweredOperator &&
                          (hasOptions ? (
                            <select
                              value={rule.value ?? ""}
                              onChange={(e) =>
                                handleUpdateLogicRule(rule.id, {
                                  value: e.target.value,
                                })
                              }
                              className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[200px] truncate"
                            >
                              <option value="">-- Select option --</option>
                              {sourceQ.options!.map((opt) => (
                                <option key={opt.id} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={rule.value ?? ""}
                              placeholder="Type value..."
                              onChange={(e) =>
                                handleUpdateLogicRule(rule.id, {
                                  value: e.target.value,
                                })
                              }
                              className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
                            />
                          ))}
                      </div>

                      {/* THEN CLAUSE */}
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-gray-200/60">
                        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-bold shrink-0">
                          THEN
                        </span>

                        {/* Action */}
                        <select
                          value={rule.action}
                          onChange={(e) => {
                            const newAction = e.target.value as LogicAction;
                            handleUpdateLogicRule(rule.id, {
                              action: newAction,
                              targetQuestionId:
                                newAction === "jump_to_ending"
                                  ? undefined
                                  : rule.targetQuestionId ||
                                    form.questions[0]?.id,
                              targetOutcomeTierId:
                                newAction === "jump_to_ending"
                                  ? form.outcomeTiers[0]?.id || "default"
                                  : undefined,
                            });
                          }}
                          className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="jump_to_question">
                            Jump to question
                          </option>
                          <option value="jump_to_ending">
                            Jump to ending screen
                          </option>
                          <option value="hide_question">Hide question</option>
                          <option value="show_question">Show question</option>
                        </select>

                        {/* Target Selection */}
                        {rule.action === "jump_to_ending" ? (
                          <select
                            value={rule.targetOutcomeTierId ?? "default"}
                            onChange={(e) =>
                              handleUpdateLogicRule(rule.id, {
                                targetOutcomeTierId: e.target.value,
                              })
                            }
                            className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[220px] truncate"
                          >
                            <option value="default">
                              Default Ending Result
                            </option>
                            {form.outcomeTiers.map((tier) => (
                              <option key={tier.id} value={tier.id}>
                                Tier: {tier.badge} {tier.title} (
                                {tier.minScorePercent}-{tier.maxScorePercent}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={rule.targetQuestionId ?? ""}
                            onChange={(e) =>
                              handleUpdateLogicRule(rule.id, {
                                targetQuestionId: e.target.value,
                              })
                            }
                            className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[240px] truncate"
                          >
                            <option value="">
                              -- Choose target question --
                            </option>
                            {form.questions.map((q, qIdx) => (
                              <option key={q.id} value={q.id}>
                                Q{qIdx + 1}: {q.title || "Untitled Question"}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {logicRules.length} {logicRules.length === 1 ? "rule" : "rules"}{" "}
                configured
              </span>
              <button
                onClick={() => setShowLogicModal(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium text-xs rounded-lg transition cursor-pointer"
              >
                Close &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON SCHEMA MODAL */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-gray-900">
                  Declarative Schema JSON
                </h3>
              </div>
              <button
                onClick={() => setShowJsonModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            {jsonError && (
              <div className="p-2.5 rounded bg-rose-50 text-rose-700 text-xs font-mono border border-rose-200">
                {jsonError}
              </div>
            )}

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="flex-1 bg-gray-900 text-emerald-400 font-mono text-xs p-4 rounded-xl outline-none resize-none min-h-[300px]"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-4 py-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={applyJsonChanges}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
              >
                Apply Schema
              </button>
            </div>
          </div>
        </div>
      )}

      {showReadiness && <PublishReadiness form={form} busy={publishing} onClose={()=>setShowReadiness(false)} onConfirm={()=>void handlePublish(true)}/> }
      {/* Publication confirmation */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Your Quiz is Published!
                  </h3>
                  <p className="text-xs text-gray-500">
                    Published on this workspace. Share the link when your server
                    is accessible.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Live Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Live URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/play/${form.id}`
                      : `/play/${form.id}`
                  }
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 outline-none"
                />
                <button
                  onClick={copyShareLink}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{shareCopied ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Link
                href={`/play/${form.id}`}
                target="_blank"
                className="p-3 rounded-xl border border-gray-200 hover:border-indigo-400 bg-gray-50/60 hover:bg-indigo-50/30 transition text-center group cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-indigo-600 mx-auto mb-1 group-hover:scale-110 transition" />
                <span className="text-xs font-semibold text-gray-800 block">
                  Open Live Form
                </span>
                <span className="text-[10px] text-gray-400">
                  Test player experience
                </span>
              </Link>

              <button
                onClick={() => {
                  setShowPublishModal(false);
                  setActiveNavTab("share");
                }}
                className="p-3 rounded-xl border border-gray-200 hover:border-indigo-400 bg-gray-50/60 hover:bg-indigo-50/30 transition text-center group cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-indigo-600 mx-auto mb-1 group-hover:scale-110 transition" />
                <span className="text-xs font-semibold text-gray-800 block">
                  Embed &amp; Share
                </span>
                <span className="text-[10px] text-gray-400">
                  Iframe &amp; popup codes
                </span>
              </button>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Picker Modal for Cover Image */}
      <MediaPickerModal
        isOpen={isCoverMediaPickerOpen}
        onClose={() => setIsCoverMediaPickerOpen(false)}
        initialUrl={form.coverPage?.imageUrl}
        onSelect={(url) => {
          setForm((prev) => ({
            ...prev,
            coverPage: {
              ...(prev.coverPage || {
                enabled: true,
                buttonText: "Get Started",
                title: prev.title || "Assessment",
              }),
              imageUrl: url,
            },
          }));
        }}
      />
    </div>
  );
}

function getDefaultQuestionTitle(type: QuestionType): string {
  switch (type) {
    case "short_answer":
      return "What is your name?";
    case "multiple_choice":
      return "Select the best answer:";
    case "email":
      return "What is your email address?";
    case "phone":
      return "What is your phone number?";
    case "full_name":
      return "What is your full name?";
    case "address":
      return "What is your mailing address?";
    case "website":
      return "What is your website address?";
    case "number":
      return "Enter a numeric value:";
    case "currency":
      return "What is the expected amount / price?";
    case "password":
      return "Create a secure password:";
    case "paragraph":
      return "Please share your detailed feedback:";
    case "heading":
      return "Section Title";
    case "subheading":
      return "Section Subtitle";
    case "banner":
      return "Notice / Information";
    case "divider":
      return "Divider";
    case "dropdown":
      return "Select an option from the list:";
    case "picture_choice":
      return "Choose your preferred image:";
    case "multiselect":
      return "Select all that apply:";
    case "checkboxes":
      return "Select all matching options:";
    case "segmented":
      return "Choose one of the options:";
    case "switch":
      return "True or False:";
    case "checkbox":
      return "I confirm and agree:";
    case "terms":
      return "Terms & Conditions Agreement:";
    case "choice_matrix":
      return "Rate each of the following criteria:";
    case "ranking":
      return "Rank the following in priority order:";
    case "rating":
      return "How would you rate this experience?";
    case "opinion_scale":
      return "On a scale of 1 to 5:";
    case "slider":
      return "Select your value range:";
    case "nps":
      return "How likely are you to recommend us?";
    case "emoji_rating":
      return "How do you feel about our service?";
    case "thumbs":
      return "Did you find this helpful?";
    case "date":
      return "Select a date:";
    case "time":
      return "What time works best?";
    case "color_picker":
      return "Choose your preferred color:";
    case "file_upload":
      return "Upload your document:";
    case "signature":
      return "Sign below:";
    case "image_multiselect":
      return "Select all images that match:";
    case "matrix_multiselect":
      return "Select all applicable criteria for each item:";
    case "like_dislike":
      return "Do you like or dislike this?";
    case "audio_recorder":
      return "Record your audio response:";
    case "datetime":
      return "Select appointment date and time:";
    case "date_range":
      return "Select your date range:";
    case "scheduler":
      return "Pick an available meeting slot:";
    case "image_upload":
      return "Upload your photo or image:";
    case "video_embed":
      return "Watch this video:";
    case "image_display":
      return "Visual Reference Figure";
    case "rich_text":
      return "Information & Instructions";
    case "accordion":
      return "Frequently Asked Questions";
    case "calculation":
      return "Calculated Total Score";
    case "hidden":
      return "Hidden Tracking Parameter";
    case "captcha":
      return "Security Verification Challenge";
    default:
      return "Untitled Question";
  }
}
