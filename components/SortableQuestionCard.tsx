"use client";

import React, { useState } from "react";
import { Question, ChoiceOption } from "@/lib/schema";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TextareaAutosize from "react-textarea-autosize";
import { Reorder } from "framer-motion";
import MediaPickerModal from "./MediaPickerModal";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  GitBranch,
  Check,
  X,
  Plus,
  Calendar,
  UploadCloud,
  PenTool,
  Clock,
  Globe,
  DollarSign,
  Lock,
  Palette,
  Grid,
  SlidersHorizontal,
  ThumbsUp,
  ThumbsDown,
  Smile,
  ExternalLink,
  FileText,
  Minus,
  ShieldCheck,
  AlignLeft,
  Sparkles,
  Image as ImageIcon,
  Heart,
  HeartCrack,
  Mic,
  Video,
  Calculator,
  EyeOff,
  CheckSquare,
  ListCollapse,
  CalendarDays,
} from "lucide-react";

export interface SortableQuestionCardProps {
  scoring?: React.ReactNode;
  q: Question;
  idx: number;
  totalQuestions: number;
  isSelected: boolean;
  mode?: "form" | "quiz" | "survey";
  hasLogic: boolean;
  onSelect: () => void;
  onMoveQuestion: (qId: string, direction: "up" | "down") => void;
  onDuplicateQuestion: (qId: string) => void;
  onDeleteQuestion: (qId: string) => void;
  onUpdateQuestion: (qId: string, updates: Partial<Question>) => void;
  onUpdateOption: (
    qId: string,
    optId: string,
    updates: Partial<ChoiceOption>,
  ) => void;
  onDeleteOption: (qId: string, optId: string) => void;
  onAddOption: (qId: string) => void;
  onMoveOption: (qId: string, optId: string, direction: "up" | "down") => void;
}

export function SortableQuestionCard({
  q,
  scoring,
  idx,
  totalQuestions,
  isSelected,
  mode = "quiz",
  hasLogic,
  onSelect,
  onMoveQuestion,
  onDuplicateQuestion,
  onDeleteQuestion,
  onUpdateQuestion,
  onUpdateOption,
  onDeleteOption,
  onAddOption,
  onMoveOption,
}: SortableQuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: q.id });

  const [mediaPickerType, setMediaPickerType] = useState<
    "option" | "question" | null
  >(null);
  const [mediaPickerTargetId, setMediaPickerTargetId] = useState<string | null>(
    null,
  );

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`rounded-xl border transition-all p-5 space-y-3 cursor-pointer relative group ${
        isDragging
          ? "opacity-35 border-dashed border-2 border-indigo-500 bg-indigo-50/40 shadow-none ring-2 ring-indigo-400/20"
          : isSelected
            ? "bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/10"
            : "bg-white hover:border-gray-300 border-gray-200/90 shadow-xs"
      }`}
    >
      {/* Question Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Drag Handle Button */}
          <button
            {...attributes}
            {...listeners}
            type="button"
            className="p-1 -ml-1 text-gray-400 hover:text-indigo-600 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 transition touch-none"
            title="Drag to reorder question"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 font-mono">
            Q{idx + 1}
          </span>
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            {q.type.replace("_", " ")}
          </span>
          {mode === "quiz" &&
            q.type !== "heading" &&
            q.type !== "subheading" &&
            q.type !== "banner" &&
            q.type !== "divider" && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                {q.points ?? 10} pts
              </span>
            )}
          {hasLogic && (
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 font-mono">
              <GitBranch className="w-3 h-3" /> logic
            </span>
          )}
        </div>

        {/* Card Control Toolbar */}
        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveQuestion(q.id, "up");
            }}
            disabled={idx === 0}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-100"
            title="Move up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveQuestion(q.id, "down");
            }}
            disabled={idx === totalQuestions - 1}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-100"
            title="Move down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateQuestion(q.id);
            }}
            className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
            title="Duplicate question"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteQuestion(q.id);
            }}
            className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50"
            title="Delete question"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline Question Title & Description */}
      <div className="space-y-1">
        <TextareaAutosize
          value={q.title ?? ""}
          onChange={(e) => onUpdateQuestion(q.id, { title: e.target.value })}
          placeholder="Type your question prompt..."
          className="w-full bg-transparent text-base font-semibold text-gray-900 outline-none placeholder:text-gray-300 resize-none overflow-hidden leading-snug"
        />
        <TextareaAutosize
          value={q.description ?? ""}
          onChange={(e) =>
            onUpdateQuestion(q.id, { description: e.target.value })
          }
          placeholder="Optional description or hint..."
          className="w-full bg-transparent text-xs text-gray-500 outline-none placeholder:text-gray-300 resize-none overflow-hidden"
        />
      </div>

      {/* Choices Canvas (Multiple Choice, Multiselect, Dropdown, Checkboxes) */}
      {(q.type === "multiple_choice" ||
        q.type === "multiselect" ||
        q.type === "dropdown" ||
        q.type === "checkboxes") && (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] text-gray-400 flex items-center justify-between mb-1">
            <span>Options ({q.options?.length || 0})</span>
            {mode === "quiz" && (
              <span className="text-emerald-600 text-[10px] font-medium">
                ✓ Checkmark marks correct answer key
              </span>
            )}
          </div>

          <Reorder.Group
            axis="y"
            values={q.options || []}
            onReorder={(newOptions) =>
              onUpdateQuestion(q.id, { options: newOptions })
            }
            className="space-y-2"
          >
            {q.options?.map((opt, optIdx) => (
              <Reorder.Item
                key={opt.id}
                value={opt}
                className={`flex items-center gap-2 p-2 rounded-lg border transition group/opt ${
                  mode === "quiz" && opt.isCorrect
                    ? "bg-emerald-50/60 border-emerald-300"
                    : "bg-gray-50/60 border-gray-200"
                }`}
              >
                {/* Option Handle */}
                <div className="flex items-center gap-0.5 text-gray-300">
                  <span
                    className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"
                    title="Drag to reorder option"
                  >
                    <GripVertical className="w-4 h-4" />
                  </span>
                </div>

                {/* Answer Key Toggle Checkmark */}
                {mode === "quiz" && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateOption(q.id, opt.id, {
                        isCorrect: !opt.isCorrect,
                      })
                    }
                    title={
                      opt.isCorrect
                        ? "Correct answer (Score awarded)"
                        : "Click to set as correct answer"
                    }
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 ${
                      opt.isCorrect
                        ? "bg-emerald-600 text-white"
                        : "border border-gray-300 hover:border-gray-400 text-transparent"
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </button>
                )}

                <input
                  type="text"
                  value={opt.label ?? ""}
                  onChange={(e) =>
                    onUpdateOption(q.id, opt.id, { label: e.target.value })
                  }
                  className="flex-1 bg-transparent text-xs text-gray-800 outline-none font-medium"
                />

                <button
                  type="button"
                  onClick={() => onDeleteOption(q.id, opt.id)}
                  className="p-1 text-gray-400 hover:text-rose-600 transition opacity-50 hover:opacity-100"
                  title="Remove option"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <button
            type="button"
            onClick={() => onAddOption(q.id)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1.5 py-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add option</span>
          </button>
        </div>
      )}

      {/* Picture Choice Studio Canvas Grid (Fillout 1:1) */}
      {(q.type === "picture_choice" || q.type === "image_multiselect") && (
        <div className="space-y-3 pt-1">
          <div className="text-[11px] text-gray-400 flex items-center justify-between mb-1">
            <span>
              {q.type === "image_multiselect"
                ? "Picture Cards (Multi-Select)"
                : "Picture Cards"}{" "}
              ({q.options?.length || 0})
            </span>
            {mode === "quiz" && (
              <span className="text-emerald-600 text-[10px] font-medium">
                ✓ Checkmark marks correct answer key
              </span>
            )}
          </div>

          <Reorder.Group
            axis="x"
            values={q.options || []}
            onReorder={(newOptions) =>
              onUpdateQuestion(q.id, { options: newOptions })
            }
            className={`grid grid-cols-1 sm:grid-cols-2 ${
              (q.pictureColumns || 3) === 2
                ? "lg:grid-cols-2"
                : (q.pictureColumns || 3) === 4
                  ? "lg:grid-cols-4"
                  : "lg:grid-cols-3"
            } gap-3`}
          >
            {q.options?.map((opt, optIdx) => (
              <Reorder.Item
                key={opt.id}
                value={opt}
                className={`rounded-xl border overflow-hidden transition group/card relative flex flex-col ${
                  mode === "quiz" && opt.isCorrect
                    ? "border-emerald-500 ring-2 ring-emerald-400/20 bg-emerald-50/20"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {/* Image Box Preview */}
                <div
                  className={`w-full relative overflow-hidden bg-gray-100 group/img ${
                    q.pictureAspectRatio === "square"
                      ? "aspect-square"
                      : q.pictureAspectRatio === "portrait"
                        ? "aspect-[3/4]"
                        : "aspect-video"
                  }`}
                >
                  {opt.imageUrl ? (
                    <img
                      src={opt.imageUrl}
                      alt={opt.label}
                      className="w-full h-full object-cover transition duration-300 group-hover/img:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1 p-2 text-center">
                      <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                      <span className="text-[10px]">No image set</span>
                    </div>
                  )}

                  {/* Answer Key Toggle Checkmark (Top Left) */}
                  {mode === "quiz" && (
                    <div className="absolute top-2 left-2 z-10">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOption(q.id, opt.id, {
                            isCorrect: !opt.isCorrect,
                          })
                        }
                        title={
                          opt.isCorrect
                            ? "Designated as correct answer (Score awarded)"
                            : "Click to set as correct answer"
                        }
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition shadow-xs cursor-pointer ${
                          opt.isCorrect
                            ? "bg-emerald-600 text-white"
                            : "bg-white/90 text-gray-400 hover:text-emerald-600 hover:bg-white border border-gray-200"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  )}
                  {/* Delete Card Button (Top Right) */}
                  <div className="absolute top-2 right-2 z-10 opacity-70 group-hover/card:opacity-100">
                    <button
                      type="button"
                      onClick={() => onDeleteOption(q.id, opt.id)}
                      className="w-6 h-6 rounded-lg bg-black/50 text-white hover:bg-rose-600 flex items-center justify-center transition shadow-xs cursor-pointer"
                      title="Remove picture card"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Reordering Controls Hover Overlay */}
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10 flex items-center justify-between opacity-0 group-hover/card:opacity-100 transition bg-black/60 backdrop-blur-xs rounded-md px-2 py-0.5 text-white text-[10px]">
                    <div className="flex items-center gap-1">
                      <span
                        className="cursor-grab active:cursor-grabbing p-0.5 hover:text-indigo-300 transition"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5 rotate-90" />
                      </span>
                    </div>
                    <span className="font-mono text-[9px] font-bold">
                      #{optIdx + 1}
                    </span>
                  </div>
                </div>

                {/* Option Label & Image URL Input */}
                <div className="p-2.5 space-y-1.5 bg-white border-t border-gray-100">
                  <input
                    type="text"
                    value={opt.label ?? ""}
                    onChange={(e) =>
                      onUpdateOption(q.id, opt.id, { label: e.target.value })
                    }
                    placeholder={`Picture label ${optIdx + 1}`}
                    className="w-full text-xs font-semibold text-gray-900 bg-transparent outline-none placeholder:text-gray-300"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMediaPickerType("option");
                        setMediaPickerTargetId(opt.id);
                      }}
                      className="w-full py-1.5 text-[10px] font-semibold text-gray-600 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 rounded transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ImageIcon className="w-3 h-3" />
                      {opt.imageUrl ? "Change Image" : "Add Image"}
                    </button>
                  </div>
                </div>
              </Reorder.Item>
            ))}

            {/* Add Picture Option Card Button */}
            <button
              type="button"
              onClick={() => onAddOption(q.id)}
              className="rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition flex flex-col items-center justify-center p-6 text-gray-400 hover:text-indigo-600 gap-2 min-h-[140px] cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-gray-500" />
              </div>
              <span className="text-xs font-semibold">Add picture card</span>
            </button>
          </Reorder.Group>
        </div>
      )}

      {/* Switch / Toggle Canvas */}
      {q.type === "switch" && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          {(q.options && q.options.length > 0
            ? q.options
            : [
                { id: "true", label: "True", isCorrect: true },
                { id: "false", label: "False", isCorrect: false },
              ]
          ).map((opt) => (
            <div
              key={opt.id}
              onClick={() =>
                onUpdateOption(q.id, opt.id, { isCorrect: !opt.isCorrect })
              }
              className={`p-3 rounded-xl border text-center cursor-pointer transition flex items-center justify-between ${
                opt.isCorrect
                  ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold"
                  : "bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="text-xs font-semibold">{opt.label}</span>
              {opt.isCorrect && (
                <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">
                  Correct
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Single Checkbox */}
      {q.type === "checkbox" && (
        <div className="pt-1">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700">
            <div className="w-4 h-4 rounded border border-gray-300 bg-white flex items-center justify-center">
              <Check className="w-3 h-3 text-indigo-600 opacity-60" />
            </div>
            <span className="font-medium">
              {q.placeholder || "I confirm and acknowledge"}
            </span>
          </div>
        </div>
      )}

      {/* Segmented Control */}
      {q.type === "segmented" && (
        <div className="pt-1">
          <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 gap-1 w-full overflow-x-auto">
            {(q.options && q.options.length > 0
              ? q.options
              : [
                  { id: "1", label: "Option 1" },
                  { id: "2", label: "Option 2" },
                  { id: "3", label: "Option 3" },
                ]
            ).map((opt, i) => (
              <button
                key={opt.id || i}
                type="button"
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition text-center truncate ${
                  i === 0
                    ? "bg-white text-gray-900 shadow-xs font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Terms & Conditions */}
      {q.type === "terms" && (
        <div className="pt-1">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700">
            <div className="w-4 h-4 rounded border border-gray-300 bg-white shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{q.termsText || "I accept the "}</span>
              <a
                href={q.termsUrl || "#"}
                onClick={(e) => e.preventDefault()}
                className="text-indigo-600 underline font-medium inline-flex items-center gap-0.5 ml-1"
              >
                <span>Terms and Privacy Policy</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Choice Matrix / Likert Grid */}
      {/* Choice Matrix & Multi-Select Matrix */}
      {(q.type === "choice_matrix" || q.type === "matrix_multiselect") && (
        <div className="pt-1 overflow-x-auto">
          <table className="w-full text-left text-xs border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="p-2.5 font-medium">Question Criteria</th>
                {(q.columns || ["Poor", "Fair", "Good", "Excellent"]).map(
                  (col, i) => (
                    <th key={i} className="p-2.5 text-center font-medium">
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {(q.rows || ["Ease of use", "Performance", "Support"]).map(
                (row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-gray-50">
                    <td className="p-2.5 text-gray-800 font-medium">{row}</td>
                    {(q.columns || ["Poor", "Fair", "Good", "Excellent"]).map(
                      (_, cIdx) => (
                        <td key={cIdx} className="p-2.5 text-center">
                          <div
                            className={`w-4 h-4 border border-gray-300 mx-auto ${
                              q.type === "matrix_multiselect"
                                ? "rounded-xs"
                                : "rounded-full"
                            }`}
                          />
                        </td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Ranking */}
      {q.type === "ranking" && (
        <div className="space-y-1.5 pt-1">
          {(
            q.items || ["First Priority", "Second Priority", "Third Priority"]
          ).map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-gray-50/70 text-xs font-medium text-gray-800"
            >
              <GripVertical className="w-3.5 h-3.5 text-gray-400" />
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Short Answer / Email / Phone / Number Canvas */}
      {(q.type === "short_answer" ||
        q.type === "email" ||
        q.type === "phone" ||
        q.type === "number") && (
        <div className="space-y-2 pt-1">
          <input
            type="text"
            disabled
            placeholder={q.placeholder || "Respondent will type answer here..."}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed"
          />
          {mode === "quiz" && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-500 font-medium">
                Correct Answer:
              </span>
              <input
                type="text"
                value={q.correctAnswerText ?? ""}
                onChange={(e) =>
                  onUpdateQuestion(q.id, { correctAnswerText: e.target.value })
                }
                placeholder="e.g. Exact Match"
                className="bg-gray-50 border border-gray-300 focus:border-indigo-500 rounded px-2.5 py-1 text-xs text-emerald-700 font-mono outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Paragraph / Long Text */}
      {q.type === "paragraph" && (
        <div className="pt-1">
          <textarea
            disabled
            rows={3}
            placeholder={
              q.placeholder ||
              "Respondent will type multiline paragraph here..."
            }
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed resize-none"
          />
        </div>
      )}

      {/* Full Name */}
      {q.type === "full_name" && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-gray-400">
              First name
            </span>
            <input
              type="text"
              disabled
              placeholder="First name"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400 cursor-not-allowed"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-gray-400">
              Last name
            </span>
            <input
              type="text"
              disabled
              placeholder="Last name"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>
      )}

      {/* Address */}
      {q.type === "address" && (
        <div className="space-y-2 pt-1">
          <input
            type="text"
            disabled
            placeholder="Street address"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400 cursor-not-allowed"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              disabled
              placeholder="City"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400 cursor-not-allowed"
            />
            <input
              type="text"
              disabled
              placeholder="State / Province"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400 cursor-not-allowed"
            />
            <input
              type="text"
              disabled
              placeholder="ZIP / Postal code"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>
      )}

      {/* Website / URL */}
      {q.type === "website" && (
        <div className="pt-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400">
            <Globe className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="font-mono">https://example.com</span>
          </div>
        </div>
      )}

      {/* Currency */}
      {q.type === "currency" && (
        <div className="pt-1">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400">
            <span className="font-bold text-gray-600">
              {q.currencySymbol || "$"}
            </span>
            <span className="font-mono">0.00</span>
          </div>
        </div>
      )}

      {/* Password */}
      {q.type === "password" && (
        <div className="pt-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400">
            <Lock className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="tracking-widest">••••••••••••</span>
          </div>
        </div>
      )}

      {/* Rating / Scale Canvas */}
      {(q.type === "opinion_scale" ||
        q.type === "rating" ||
        q.type === "nps") && (
        <div className="flex items-center gap-1.5 pt-2 overflow-x-auto">
          {Array.from(
            { length: (q.maxRating ?? 5) - (q.minRating ?? 1) + 1 },
            (_, i) => (q.minRating ?? 1) + i,
          ).map((num) => (
            <div
              key={num}
              className="flex-1 min-w-[32px] h-9 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 flex items-center justify-center text-xs font-mono font-bold"
            >
              {num}
            </div>
          ))}
        </div>
      )}

      {/* Slider */}
      {q.type === "slider" && (
        <div className="space-y-1.5 pt-2">
          <div className="h-2 bg-gray-200 rounded-full w-full relative">
            <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-600 rounded-full shadow-xs" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 font-mono">
            <span>{q.minVal ?? 0}</span>
            <span>{q.maxVal ?? 100}</span>
          </div>
        </div>
      )}

      {/* Emoji Rating */}
      {q.type === "emoji_rating" && (
        <div className="flex items-center justify-between gap-2 pt-2">
          {["😠", "🙁", "😐", "🙂", "😀"].map((emoji, idx) => (
            <div
              key={idx}
              className="flex-1 py-2 rounded-xl bg-gray-50 border border-gray-200 text-center text-xl hover:bg-gray-100 transition"
            >
              {emoji}
            </div>
          ))}
        </div>
      )}

      {/* Thumbs */}
      {q.type === "thumbs" && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium text-xs">
            <ThumbsUp className="w-4 h-4 text-emerald-600" />
            <span>Thumbs Up</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium text-xs">
            <ThumbsDown className="w-4 h-4 text-rose-600" />
            <span>Thumbs Down</span>
          </div>
        </div>
      )}

      {/* Date Picker Canvas */}
      {q.type === "date" && (
        <div className="pt-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Select a date (YYYY-MM-DD)</span>
          </div>
        </div>
      )}

      {/* Time Picker Canvas */}
      {q.type === "time" && (
        <div className="pt-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>Select time (HH:MM AM/PM)</span>
          </div>
        </div>
      )}

      {/* Color Picker */}
      {q.type === "color_picker" && (
        <div className="pt-1">
          <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
            <div className="w-5 h-5 rounded-full bg-indigo-600 border border-gray-200 shadow-xs" />
            <span className="font-mono font-medium">#4F46E5</span>
          </div>
        </div>
      )}

      {/* File Upload Canvas */}
      {q.type === "file_upload" && (
        <div className="pt-1">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center bg-gray-50/50 flex flex-col items-center justify-center space-y-1">
            <UploadCloud className="w-6 h-6 text-gray-400" />
            <span className="text-xs font-medium text-gray-600">
              Drag and drop files here, or browse
            </span>
            <span className="text-[10px] text-gray-400">
              Supports PDF, PNG, JPG up to 10MB
            </span>
          </div>
        </div>
      )}

      {/* Signature Canvas */}
      {q.type === "signature" && (
        <div className="pt-1">
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 flex items-center justify-center gap-2 text-xs text-gray-400">
            <PenTool className="w-4 h-4 text-gray-400" />
            <span>Respondent signature area</span>
          </div>
        </div>
      )}

      {/* Subheading Display */}
      {q.type === "subheading" && (
        <div className="pt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 font-medium">
          {q.subheadingText || "Subheading description & section context"}
        </div>
      )}

      {/* Banner Display */}
      {q.type === "banner" && (
        <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Callout banner notice and instructions</span>
        </div>
      )}

      {/* Like / Dislike */}
      {q.type === "like_dislike" && (
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-100" />
            <span className="text-xs font-semibold text-gray-700">Like</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300">
            <HeartCrack className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-700">Dislike</span>
          </div>
        </div>
      )}

      {/* Voice / Audio Recorder */}
      {q.type === "audio_recorder" && (
        <div className="p-3.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-800">
                Voice Note Recorder
              </div>
              <div className="text-[11px] text-gray-500">
                Click to record voice submission (max 2 mins)
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-mono text-gray-600">
            0:00 / 2:00
          </span>
        </div>
      )}

      {/* Combined Date & Time */}
      {q.type === "datetime" && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-400">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>Select Date (YYYY-MM-DD)</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-400">
            <Clock className="w-4 h-4 text-gray-500" />
            <span>Select Time (HH:MM AM/PM)</span>
          </div>
        </div>
      )}

      {/* Date Range */}
      {q.type === "date_range" && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-400">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <span>Start Date: YYYY-MM-DD</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-400">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <span>End Date: YYYY-MM-DD</span>
          </div>
        </div>
      )}

      {/* Meeting / Appointment Scheduler */}
      {q.type === "scheduler" && (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold text-gray-500 flex items-center justify-between">
            <span>Available Time Slots</span>
            <span className="text-[10px] text-indigo-600 font-medium">
              30 min meetings
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(
              q.timeSlots || ["09:00 AM", "10:30 AM", "01:00 PM", "03:30 PM"]
            ).map((slot, i) => (
              <div
                key={i}
                className="py-2 text-center rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:border-indigo-400"
              >
                {slot}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dedicated Image Upload */}
      {q.type === "image_upload" && (
        <div className="p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 hover:bg-gray-50 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <ImageIcon className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div>
            <span className="text-xs font-semibold text-indigo-600">
              Click to upload photo
            </span>
            <span className="text-xs text-gray-500"> or drag and drop</span>
          </div>
          <span className="text-[10px] text-gray-400">
            PNG, JPG, WebP up to 10MB
          </span>
        </div>
      )}

      {/* Video Embed Player */}
      {q.type === "video_embed" && (
        <div className="space-y-2 pt-1">
          <div className="w-full aspect-video rounded-xl bg-gray-900 border border-gray-800 flex flex-col items-center justify-center text-white relative overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
              <Video className="w-6 h-6 fill-white" />
            </div>
            <span className="text-xs font-semibold mt-2">
              Embedded Video Preview
            </span>
            <span className="text-[10px] text-gray-400 font-mono mt-0.5">
              {q.videoUrl || "https://www.youtube.com/watch?v=..."}
            </span>
          </div>
          <input
            type="text"
            value={q.videoUrl ?? ""}
            onChange={(e) =>
              onUpdateQuestion(q.id, { videoUrl: e.target.value })
            }
            placeholder="Paste YouTube, Vimeo, or MP4 URL..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-800 outline-none font-mono"
          />
        </div>
      )}

      {/* Image Display Figure */}
      {q.type === "image_display" && (
        <div className="space-y-2 pt-1">
          <div className="w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200 aspect-[16/7]">
            {q.mediaUrl ? (
              <img
                src={q.mediaUrl}
                alt="Figure"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1.5">
                <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                <span className="text-xs">No image URL configured</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setMediaPickerType("question");
              setMediaPickerTargetId(q.id);
            }}
            className="w-full py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            {q.mediaUrl ? "Change Display Image" : "Select Image to Display"}
          </button>
        </div>
      )}

      {/* Rich Text / Markdown Block */}
      {q.type === "rich_text" && (
        <div className="space-y-1.5 pt-1">
          <textarea
            rows={3}
            value={q.richTextContent ?? ""}
            onChange={(e) =>
              onUpdateQuestion(q.id, { richTextContent: e.target.value })
            }
            placeholder="Enter markdown or formatted HTML content..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 outline-none font-sans"
          />
          <div className="text-[10px] text-gray-400">
            Supports **bold**, *italics*, bullet lists, and links.
          </div>
        </div>
      )}

      {/* Accordion / FAQ Dropdown */}
      {q.type === "accordion" && (
        <div className="space-y-2 pt-1">
          {(
            q.accordionItems || [
              {
                id: "1",
                title: "Frequently Asked Question 1",
                content: "Details and instructions go here.",
              },
              {
                id: "2",
                title: "Frequently Asked Question 2",
                content: "Secondary explanation content.",
              },
            ]
          ).map((item, i) => (
            <div
              key={item.id || i}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50/50"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-gray-800">
                <span>{item.title}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {item.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calculation Formula Field */}
      {q.type === "calculation" && (
        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <div>
              <div className="text-xs font-bold text-indigo-950 font-mono">
                Formula: {q.calculationFormula || "[Calculated Score / Total]"}
              </div>
              <div className="text-[10px] text-indigo-600">
                Calculates value in real-time based on previous answers
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold">
            Auto
          </span>
        </div>
      )}

      {/* Hidden Variable Field */}
      {q.type === "hidden" && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-amber-700" />
            <div>
              <span className="text-xs font-semibold text-amber-900">
                Hidden Parameter:{" "}
              </span>
              <span className="text-xs font-mono text-amber-800 font-bold">
                {q.hiddenParamName || "utm_source"}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded">
            Not shown to respondent
          </span>
        </div>
      )}

      {/* CAPTCHA / Human Verification */}
      {q.type === "captcha" && (
        <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between max-w-sm">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded border border-gray-300 bg-white flex items-center justify-center">
              <Check className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">
              I am human (Verification challenge)
            </span>
          </div>
          <ShieldCheck className="w-5 h-5 text-gray-400" />
        </div>
      )}

      {/* Divider */}
      {q.type === "divider" && (
        <div className="py-2 flex items-center gap-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider">
            Divider
          </span>
          <div className="flex-1 border-t border-gray-200" />
        </div>
      )}

      {scoring}

      {/* Post-Answer Educational Explanation Box */}
      {mode === "quiz" &&
        q.type !== "heading" &&
        q.type !== "subheading" &&
        q.type !== "banner" &&
        q.type !== "divider" &&
        q.type !== "image_display" &&
        q.type !== "rich_text" &&
        q.type !== "accordion" &&
        q.type !== "hidden" && (
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
              💡 Explanation (Shown after answer or on results):
            </label>
            <textarea
              rows={2}
              value={q.explanation ?? ""}
              onChange={(e) =>
                onUpdateQuestion(q.id, { explanation: e.target.value })
              }
              placeholder="Explain why this answer is correct..."
              className="w-full bg-gray-50/70 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2 text-xs text-gray-800 outline-none resize-none transition"
            />
          </div>
        )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={mediaPickerType !== null}
        onClose={() => {
          setMediaPickerType(null);
          setMediaPickerTargetId(null);
        }}
        initialUrl={
          mediaPickerType === "option"
            ? q.options?.find((opt) => opt.id === mediaPickerTargetId)?.imageUrl
            : mediaPickerType === "question"
              ? q.mediaUrl
              : undefined
        }
        onSelect={(url) => {
          if (mediaPickerType === "option" && mediaPickerTargetId) {
            onUpdateOption(q.id, mediaPickerTargetId, { imageUrl: url });
          } else if (mediaPickerType === "question") {
            onUpdateQuestion(q.id, { mediaUrl: url });
          }
        }}
      />
    </div>
  );
}
