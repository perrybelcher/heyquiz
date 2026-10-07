import { FormSchemaType } from "./schema";

export const DEFAULT_FORMS: FormSchemaType[] = [
  {
    id: "ts-pro-mastery",
    title: "TypeScript & Modern Full-Stack Pro Assessment",
    description:
      "Test your depth in React 19, TypeScript type narrowing, and modern web architecture.",
    mode: "quiz",
    theme: {
      id: "fillout-light",
      primaryColor: "#4f46e5",
      accentColor: "#10b981",
      backgroundColor: "#f4f5f7",
      cardColor: "#ffffff",
      textColor: "#111827",
      font: "sans",
      layout: "step",
      borderRadius: "lg",
    },
    settings: {
      showProgressBar: true,
      shuffleQuestions: false,
      timerMinutes: 10,
      passingScorePercentage: 75,
      feedbackMode: "end",
      showAnswerKeyOnFinish: true,
      allowRetake: true,
      enableKeyboardShortcuts: true,
    },
    questions: [
      {
        id: "q1",
        type: "multiple_choice",
        title:
          "In React 19, what is the primary benefit of the 'useActionState' hook?",
        description:
          "Consider server-side mutations, pending state transitions, and optimistic updates.",
        required: true,
        points: 20,
        shuffleOptions: true,
        options: [
          {
            id: "opt1",
            label:
              "It manages async form actions, tracks pending status, and returns the optimistic result automatically.",
            isCorrect: true,
            explanation:
              "useActionState accepts an action handler and returns [state, formAction, isPending], drastically simplifying form lifecycle handling.",
          },
          {
            id: "opt2",
            label:
              "It replaces Redux and Zustand for global client-side state caching.",
            isCorrect: false,
            explanation:
              "useActionState is specifically designed for handling individual async actions and form submissions, not global state trees.",
          },
          {
            id: "opt3",
            label:
              "It turns any client component into an edge-rendered WebAssembly module.",
            isCorrect: false,
            explanation:
              "React hooks do not compile client code into WebAssembly modules.",
          },
          {
            id: "opt4",
            label:
              "It forces synchronous rendering by bypassing React's fiber scheduler.",
            isCorrect: false,
            explanation:
              "React 19 leverages concurrent rendering and transitions, never blocking sync rendering.",
          },
        ],
        explanation:
          "useActionState is React 19's standardized hook for form submissions and server actions with built-in isPending tracking.",
      },
      {
        id: "q2",
        type: "multiple_choice",
        title:
          "Which TypeScript utility type constructs a type consisting of all properties of T set to optional?",
        description: "Choose the standard built-in mapped type.",
        required: true,
        points: 15,
        options: [
          {
            id: "o21",
            label: "Partial<T>",
            isCorrect: true,
            explanation:
              "Partial<T> iterates over keys of T adding the ? modifier to each.",
          },
          {
            id: "o22",
            label: "Pick<T>",
            isCorrect: false,
            explanation: "Pick<T, K> extracts a subset of properties K from T.",
          },
          {
            id: "o23",
            label: "Nullable<T>",
            isCorrect: false,
            explanation: "Nullable is not a built-in standard TS utility type.",
          },
          {
            id: "o24",
            label: "Optional<T>",
            isCorrect: false,
            explanation: "The standard name in TypeScript is Partial<T>.",
          },
        ],
        explanation:
          "Partial<T> marks every key in type T as optional ({ [P in keyof T]?: T[P] }).",
      },
      {
        id: "q3",
        type: "multiselect",
        title:
          "Which of the following are valid HTTP methods that are idempotent according to RFC 9110?",
        description:
          "Select ALL that apply. An idempotent method can be called multiple times with the same intended side effect.",
        required: true,
        points: 25,
        options: [
          {
            id: "o31",
            label: "GET",
            isCorrect: true,
            explanation: "GET is both safe and idempotent.",
          },
          {
            id: "o32",
            label: "PUT",
            isCorrect: true,
            explanation:
              "PUT replaces target resource state, making repeated identical requests produce the same end result.",
          },
          {
            id: "o33",
            label: "DELETE",
            isCorrect: true,
            explanation:
              "DELETE is idempotent; once deleted, further deletes still leave the resource deleted.",
          },
          {
            id: "o34",
            label: "POST",
            isCorrect: false,
            explanation:
              "POST is typically non-idempotent because multiple calls create multiple new resources.",
          },
        ],
        explanation:
          "GET, PUT, and DELETE are idempotent according to HTTP specs; POST is not idempotent.",
      },
      {
        id: "q4",
        type: "switch",
        title:
          "True or False: In TypeScript, 'unknown' is type-safe whereas 'any' disables type checking entirely.",
        description:
          "Consider how the type checker forces narrowing before property access.",
        required: true,
        points: 20,
        options: [
          {
            id: "b_true",
            label: "True",
            isCorrect: true,
            explanation:
              "Correct! 'unknown' requires a type check or narrowing before you can invoke methods or access properties on it.",
          },
          {
            id: "b_false",
            label: "False",
            isCorrect: false,
            explanation:
              "Incorrect. 'unknown' is indeed the type-safe counterpart to 'any'.",
          },
        ],
        explanation:
          "'unknown' is the top type where values cannot be operated on without explicit type narrowing.",
      },
      {
        id: "q5",
        type: "short_answer",
        title:
          "What is the acronym for the standard protocol for connecting AI models to external tools and data sources?",
        description: "Hint: 3 letters (e.g. Model Context Protocol).",
        required: true,
        points: 20,
        correctAnswerText: "MCP",
        placeholder: "e.g. API",
        explanation:
          "MCP stands for Model Context Protocol, the open standard championed by Anthropic and adopted across the agent ecosystem.",
      },
    ],
    outcomeTiers: [
      {
        id: "tier-1",
        minScorePercent: 85,
        maxScorePercent: 100,
        badge: "🏆 Principal Architect",
        title: "Exceptional Depth & Precision",
        message:
          "You scored in the top tier! Your grasp of React 19, TypeScript typing, and network semantics is razor sharp.",
        ctaText: "Share Results",
      },
      {
        id: "tier-2",
        minScorePercent: 60,
        maxScorePercent: 84,
        badge: "✨ Senior Engineer",
        title: "Solid Foundations",
        message:
          "Great performance! You demonstrated good command of modern patterns with only minor gaps in niche edge cases.",
        ctaText: "Review Answer Key",
      },
      {
        id: "tier-3",
        minScorePercent: 0,
        maxScorePercent: 59,
        badge: "📚 Continuous Learner",
        title: "Room for Growth",
        message:
          "Good effort! Take a look through the detailed answer keys and explanations below to level up on these topics.",
        ctaText: "Retake Quiz",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "agentic-ai-quiz",
    title: "AI & Agentic Engineering Sprint",
    description:
      "Rapid quiz covering prompt chaining, tool schemas, and agent loop execution.",
    mode: "quiz",
    theme: {
      id: "fillout-light",
      primaryColor: "#4f46e5",
      accentColor: "#10b981",
      backgroundColor: "#f4f5f7",
      cardColor: "#ffffff",
      textColor: "#111827",
      font: "sans",
      layout: "step",
      borderRadius: "lg",
    },
    settings: {
      showProgressBar: true,
      shuffleQuestions: true,
      timerMinutes: 5,
      passingScorePercentage: 70,
      feedbackMode: "immediate",
      showAnswerKeyOnFinish: true,
      allowRetake: true,
      enableKeyboardShortcuts: true,
    },
    questions: [
      {
        id: "ai-1",
        type: "multiple_choice",
        title:
          "What differentiates an autonomous agent from a simple one-shot LLM prompt?",
        required: true,
        points: 25,
        options: [
          {
            id: "a1",
            label:
              "The agent executes an iterative perceive-plan-act loop with tool execution and environment feedback.",
            isCorrect: true,
          },
          {
            id: "a2",
            label:
              "The agent always uses more parameters than a standard model.",
            isCorrect: false,
          },
          {
            id: "a3",
            label: "The agent doesn't require any system prompt.",
            isCorrect: false,
          },
        ],
        explanation:
          "Agents operate in an iterative loop: they observe tool outputs, reflect, and take subsequent actions until goal completion.",
      },
      {
        id: "ai-2",
        type: "multiple_choice",
        title:
          "Why is JSON Schema preferred for function/tool calling in LLMs?",
        required: true,
        points: 25,
        options: [
          {
            id: "a21",
            label:
              "It provides deterministic validation and allows models to generate structured arguments reliably.",
            isCorrect: true,
          },
          {
            id: "a22",
            label: "It makes the prompt 10x shorter than raw text.",
            isCorrect: false,
          },
          { id: "a23", label: "It bypasses token limits.", isCorrect: false },
        ],
        explanation:
          "JSON Schema defines strict types, required fields, and enums so agents generate arguments that can be safely validated.",
      },
      {
        id: "ai-3",
        type: "opinion_scale",
        title: "How confident are you building multi-agent workflows?",
        description: "1 = Beginner, 5 = Highly experienced",
        required: false,
        points: 0,
        minRating: 1,
        maxRating: 5,
        ratingLabels: { low: "Beginner", high: "Expert" },
      },
    ],
    outcomeTiers: [
      {
        id: "ai-tier-1",
        minScorePercent: 70,
        maxScorePercent: 100,
        badge: "🤖 Agent Architect",
        title: "Mission Accomplished!",
        message:
          "You understand the core principles of tool schemas, loops, and autonomous workflows.",
      },
      {
        id: "ai-tier-2",
        minScorePercent: 0,
        maxScorePercent: 69,
        badge: "⚡ In Training",
        title: "Keep Experimenting",
        message:
          "Review the answers and try the immediate feedback mode again!",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
