import { CaptureSchema, type CaptureConfig, type ContactRecord } from "./contacts";
import { z } from "zod";
import {
  MarketingSchema,
  type MarketingConfig,
  type MarketingResult,
} from "./marketing";

export const QuestionTypeEnum = z.enum([
  // Text & Contact (10)
  "short_answer",
  "paragraph",
  "email",
  "phone",
  "full_name",
  "address",
  "website",
  "number",
  "currency",
  "password",
  // Choices & Selection (13)
  "multiple_choice",
  "multiselect",
  "dropdown",
  "picture_choice",
  "image_multiselect",
  "switch",
  "checkbox",
  "checkboxes",
  "terms",
  "segmented",
  "choice_matrix",
  "matrix_multiselect",
  "ranking",
  // Ratings & Feedback (8)
  "rating",
  "opinion_scale",
  "slider",
  "nps",
  "emoji_rating",
  "thumbs",
  "like_dislike",
  "audio_recorder",
  // Date, Time & Scheduling (5)
  "date",
  "time",
  "datetime",
  "date_range",
  "scheduler",
  // Media & Signatures (5)
  "file_upload",
  "image_upload",
  "signature",
  "color_picker",
  "video_embed",
  // Display & Layout (7)
  "heading",
  "subheading",
  "banner",
  "divider",
  "image_display",
  "rich_text",
  "accordion",
  // Advanced & Logic (3)
  "calculation",
  "hidden",
  "captcha",
]);

export type QuestionType = z.infer<typeof QuestionTypeEnum>;

export interface ChoiceOption {
  id: string;
  label: string;
  isCorrect?: boolean;
  explanation?: string;
  imageUrl?: string;
}

export const ChoiceOptionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string(),
  isCorrect: z.boolean().optional().default(false),
  explanation: z.string().optional(),
  imageUrl: z.string().optional(),
});

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  points?: number;
  pageId?: string;
  options?: ChoiceOption[];
  correctAnswerText?: string;
  explanation?: string;
  minRating?: number;
  maxRating?: number;
  ratingLabels?: { low?: string; high?: string };
  placeholder?: string;
  shuffleOptions?: boolean;
  minVal?: number;
  maxVal?: number;
  stepVal?: number;
  rows?: string[];
  columns?: string[];
  currencySymbol?: string;
  termsUrl?: string;
  termsText?: string;
  subheadingText?: string;
  items?: string[];
  pictureColumns?: number;
  pictureAspectRatio?: "square" | "landscape" | "portrait";
  mediaUrl?: string;
  videoUrl?: string;
  richTextContent?: string;
  accordionItems?: { id: string; title: string; content: string }[];
  calculationFormula?: string;
  hiddenParamName?: string;
  timeSlots?: string[];
  dateRange?: { start?: string; end?: string };
  maxFiles?: number;
  maxFileSizeMB?: number;
  matrixAnswerKey?: Record<string, string | string[]>;
}

export const QuestionSchema: z.ZodType<Question> = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
  type: QuestionTypeEnum,
  title: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  points: z.number().min(0).optional(),
  pageId: z.string().optional(),
  options: z.array(ChoiceOptionSchema).optional(),
  correctAnswerText: z.string().optional(),
  explanation: z.string().optional(),
  minRating: z.number().optional(),
  maxRating: z.number().optional(),
  ratingLabels: z
    .object({
      low: z.string().optional(),
      high: z.string().optional(),
      lowLabel: z.string().optional(),
      highLabel: z.string().optional(),
    })
    .optional(),
  placeholder: z.string().optional(),
  shuffleOptions: z.boolean().optional(),
  minVal: z.number().optional(),
  maxVal: z.number().optional(),
  stepVal: z.number().optional(),
  rows: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
  currencySymbol: z.string().optional(),
  termsUrl: z.string().optional(),
  termsText: z.string().optional(),
  subheadingText: z.string().optional(),
  items: z.array(z.string()).optional(),
  pictureColumns: z.number().optional(),
  pictureAspectRatio: z.enum(["square", "landscape", "portrait"]).optional(),
  mediaUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  richTextContent: z.string().optional(),
  accordionItems: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .max(128)
          .regex(/^[a-zA-Z0-9_-]+$/),
        title: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
  calculationFormula: z.string().optional(),
  hiddenParamName: z.string().optional(),
  timeSlots: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
  maxFiles: z.number().optional(),
  maxFileSizeMB: z.number().min(1).max(25).optional(),
  matrixAnswerKey: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional(),
});

export interface OutcomeTier {
  id: string;
  minScorePercent: number;
  maxScorePercent: number;
  badge: string;
  title: string;
  message: string;
  ctaText?: string;
  ctaUrl?: string;
}

export const OutcomeTierSchema: z.ZodType<OutcomeTier> = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
  minScorePercent: z.number().min(0).max(100),
  maxScorePercent: z.number().min(0).max(100),
  badge: z.string(),
  title: z.string(),
  message: z.string(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
});

export interface FormTheme {
  id?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  font?: "sans" | "serif" | "mono";
  layout?: "step" | "scroll";
  borderRadius?: "none" | "md" | "lg" | "full";
}

export const FormThemeSchema: z.ZodType<FormTheme> = z.object({
  id: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  cardColor: z.string().optional(),
  textColor: z.string().optional(),
  font: z.enum(["sans", "serif", "mono"]).optional(),
  layout: z.enum(["step", "scroll"]).optional(),
  borderRadius: z.enum(["none", "md", "lg", "full"]).optional(),
});

export interface FormPage {
  id: string;
  title: string;
  description?: string;
  questionIds: string[];
}

export const FormPageSchema: z.ZodType<FormPage> = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string(),
  description: z.string().optional(),
  questionIds: z.array(z.string()),
});

export interface CoverPageConfig {
  enabled: boolean;
  title: string;
  subtitle?: string;
  buttonText: string;
  imageUrl?: string;
  estimatedMinutes?: number;
  showQuestionCount?: boolean;
}

export const CoverPageConfigSchema: z.ZodType<CoverPageConfig> = z.object({
  enabled: z.boolean(),
  title: z.string(),
  subtitle: z.string().optional(),
  buttonText: z.string(),
  imageUrl: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  showQuestionCount: z.boolean().optional(),
});

export interface EndingPageConfig {
  title: string;
  message: string;
  buttonText?: string;
  redirectUrl?: string;
  allowRetake?: boolean;
  showShareButtons?: boolean;
  showReviewAnswers?: boolean;
}

export const EndingPageConfigSchema: z.ZodType<EndingPageConfig> = z.object({
  title: z.string(),
  message: z.string(),
  buttonText: z.string().optional(),
  redirectUrl: z.string().optional(),
  allowRetake: z.boolean().optional(),
  showShareButtons: z.boolean().optional(),
  showReviewAnswers: z.boolean().optional(),
});

export interface FormSettings {
  showProgressBar?: boolean;
  progressBarMode?: "percentage" | "steps" | "pages" | "questions" | "none";
  enablePageJumps?: boolean;
  showReviewBeforeSubmit?: boolean;
  shuffleQuestions?: boolean;
  timerMinutes?: number;
  passingScorePercentage?: number;
  feedbackMode?: "immediate" | "end";
  showAnswerKeyOnFinish?: boolean;
  allowRetake?: boolean;
  enableKeyboardShortcuts?: boolean;
}

export const FormSettingsSchema: z.ZodType<FormSettings> = z.object({
  showProgressBar: z.boolean().optional(),
  progressBarMode: z
    .enum(["percentage", "steps", "pages", "questions", "none"])
    .optional(),
  enablePageJumps: z.boolean().optional(),
  showReviewBeforeSubmit: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
  timerMinutes: z.number().min(0).max(1440).optional(),
  passingScorePercentage: z.number().min(0).max(100).optional(),
  feedbackMode: z.enum(["immediate", "end"]).optional(),
  showAnswerKeyOnFinish: z.boolean().optional(),
  allowRetake: z.boolean().optional(),
  enableKeyboardShortcuts: z.boolean().optional(),
});

export type LogicOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "is_answered"
  | "is_not_answered";

export type LogicAction =
  | "jump_to_question"
  | "jump_to_ending"
  | "hide_question"
  | "show_question";

export interface LogicRule {
  id: string;
  sourceQuestionId: string;
  operator: LogicOperator;
  value?: string;
  action: LogicAction;
  targetQuestionId?: string;
  targetOutcomeTierId?: string;
}

export const LogicRuleSchema: z.ZodType<LogicRule> = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
  sourceQuestionId: z.string(),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "less_than",
    "is_answered",
    "is_not_answered",
  ]),
  value: z.string().optional(),
  action: z.enum([
    "jump_to_question",
    "jump_to_ending",
    "hide_question",
    "show_question",
  ]),
  targetQuestionId: z.string().optional(),
  targetOutcomeTierId: z.string().optional(),
});

export interface FormSchemaType {
  capture?: CaptureConfig;
  marketing?: MarketingConfig;
  id: string;
  title: string;
  description?: string;
  mode: "quiz" | "survey" | "form";
  theme: FormTheme;
  settings: FormSettings;
  questions: Question[];
  outcomeTiers: OutcomeTier[];
  logicRules?: LogicRule[];
  pages?: FormPage[];
  coverPage?: CoverPageConfig;
  endingPage?: EndingPageConfig;
  createdAt?: string;
  updatedAt?: string;
  revision?: number;
  publishedAt?: string;
}

export const FormSchema: z.ZodType<FormSchemaType> = z.object({
  capture: CaptureSchema.optional(),
  marketing: MarketingSchema.optional(),
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string(),
  description: z.string().optional(),
  mode: z.enum(["quiz", "survey", "form"]),
  theme: FormThemeSchema.default({
    primaryColor: "#4f46e5",
    backgroundColor: "#f8fafc",
    cardColor: "#ffffff",
    textColor: "#0f172a",
    font: "sans",
    layout: "step",
    borderRadius: "lg",
  }),
  settings: FormSettingsSchema.default({}),
  questions: z.array(QuestionSchema).max(200).default([]),
  outcomeTiers: z.array(OutcomeTierSchema).optional().default([]),
  logicRules: z.array(LogicRuleSchema).optional().default([]),
  pages: z.array(FormPageSchema).optional(),
  coverPage: CoverPageConfigSchema.optional(),
  endingPage: EndingPageConfigSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  revision: z.number().int().nonnegative().optional(),
  publishedAt: z.string().optional(),
});

export interface QuestionGradingResult {
  questionId: string;
  questionTitle: string;
  type: QuestionType;
  maxPoints: number;
  earnedPoints: number;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string;
}

export interface QuizSubmissionResult {
  contact?: ContactRecord;
  contactCaptured?: boolean;
  marketing?: MarketingResult;
  id?: string;
  formId: string;
  totalQuestions: number;
  totalPointsPossible: number;
  totalPointsEarned: number;
  percentageScore: number;
  passed: boolean;
  matchedTier?: OutcomeTier;
  grading: QuestionGradingResult[];
  answers?: Record<string, unknown>;
  respondentName?: string;
  submittedAt: string;
}
