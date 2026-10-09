import { FormSchema, type Question } from "./schema";
import { MarketingSchema } from "./marketing";
import { marketingTemplate } from "./marketing-templates";

export const launchTemplates = [
  { id: "product_finder", name: "Everyday carry finder", summary: "Help shoppers choose a bag around their real day, with fit exclusions and three personalized recommendations.", detail: "5 questions · 3 products · fit checks" },
  { id: "scorecard", name: "Follow-up readiness scorecard", summary: "Turn six answers into a practical action plan across capture, follow-up, and measurement.", detail: "6 questions · 3 categories · action plans" },
  { id: "consultation", name: "Find your next growth step", summary: "Guide prospects toward a self-guided plan, a focused review, or a planning conversation without forcing a booking.", detail: "5 questions · 3 paths · optional contact capture" },
] as const;
export type LaunchTemplateId = typeof launchTemplates[number]["id"];
const question = (id: string, title: string, labels: string[]): Question => ({ id, title, type: "multiple_choice", required: true, points: 0, options: labels.map((label, i) => ({ id: `a${i}`, label })) });

/** Independent drafts: template IDs stay stable for scoring; each caller supplies a new form ID. */
export function launchTemplate(kind: LaunchTemplateId, id: string) {
  const f = marketingTemplate(kind === "consultation" ? "segmentation" : kind, id);
  const m = f.marketing!;
  f.theme = { ...f.theme, primaryColor: "#a9232b", backgroundColor: "#faf8f4" };
  f.capture = { enabled: true, placement: "before_results", required: false, name: "optional", phone: "off", title: "Your next step is ready", description: "Share your details if you would like the quiz owner to follow up, or skip to see your results.", buttonText: "See my results", marketingEnabled: false, marketingLabel: "Yes, I would like marketing emails.", privacyUrl: "" };
  if (kind === "product_finder") {
    f.questions.splice(2, 0,
      question("routine", "Where will your bag spend most of its time?", ["Quick errands and walks", "Commuting and workdays", "Overnight stays and weekends", "My routine varies"]),
      question("space", "When you pack, which sounds most like you?", ["Just the essentials, then I’m off", "Everything has its own place", "A little extra room feels useful", "I’m still figuring that out"]));
    for (const qid of ["routine", "space"]) for (let i = 0; i < 3; i++) m.rules.push({ id: `${qid}-${i}`, questionId: qid, answerId: `a${i}`, targetId: m.outcomes[i].id, effect: "add", points: 1, reason: qid === "routine" ? ["Your days call for a compact carry.", "Your routine includes work and commuting.", "You want room for overnight plans."][i] : ["You prefer to carry only the essentials.", "You value an organized bag.", "Extra packing room matters to you."][i] });
    // Laptop protection is a hard requirement, not a preference a high score can outweigh.
    for (const targetId of ["light", "travel"]) m.rules.push({ id: `laptop-${targetId}`, questionId: "use", answerId: "a1", targetId, effect: "exclude", points: 0, reason: "" });
    f.description = "A lighter day starts with a bag that fits it. Answer five quick questions to explore your match. Fictional product example.";
    m.resultSections = [{ id: "check-fit", type: "faq", title: "What should I check before choosing?", body: "Compare the actual dimensions, materials, and capacity with what you carry. This example matches preferences; it does not verify physical fit.", url: "", label: "" }];
  } else if (kind === "scorecard") {
    f.title = "Where could your follow-up work better?";
    f.description = "Find the next practical improvement in how you handle inquiries. Six questions. An honest snapshot, not a sales forecast.";
    const labels = ["Yes, consistently", "Sometimes, but it varies", "Not yet", "I don’t know"];
    f.questions = [
      question("capture", "Can your team find every new inquiry in one shared place?", labels),
      question("context", "Can you see what each person asked for without searching old messages?", labels),
      question("owner", "Does every inquiry have someone responsible for the next step?", labels),
      question("routine", "If someone doesn’t reply, is there a clear follow-up routine?", labels),
      question("source", "Can you tell which channels bring inquiries that become customers?", labels),
      question("review", "Do you regularly review where interested people stop moving forward?", labels),
    ];
    m.rules = [];
    m.categories = [
      { id: "capture", title: "Capture and context", description: "Keep inquiries and their context together.", minAnswers: 2 },
      { id: "followup", title: "Consistent follow-up", description: "Give each inquiry an owner and a next step.", minAnswers: 2 },
      { id: "measurement", title: "Learning from results", description: "Use a repeatable review to decide what to improve.", minAnswers: 2 },
    ];
    const actions = ["Choose one shared place for inquiries and record what each person needs.", "Assign an owner and a dated next step to every open inquiry.", "Review one month of inquiries alongside their sources and outcomes."];
    m.categories.forEach((category, index) => {
      category.bands = [
        { id: "start", min: 0, max: 49, title: "Build the foundation", advice: actions[index], action: actions[index], ctaLabel: "", ctaUrl: "" },
        { id: "steady", min: 50, max: 99, title: "Make it consistent", advice: "You have part of the process in place. Find where it depends on memory or individual effort.", action: actions[index], ctaLabel: "", ctaUrl: "" },
        { id: "strong", min: 100, max: 100, title: "Keep learning", advice: "Your answers describe a consistent process. Check a recent sample of inquiries to confirm it works in practice.", action: "Review a recent sample and look for exceptions.", ctaLabel: "", ctaUrl: "" },
      ];
    });
    f.questions.forEach((q, index) => { for (let i = 0; i < 3; i++) m.rules.push({ id: `${q.id}-${i}`, questionId: q.id, answerId: `a${i}`, targetId: m.categories[Math.floor(index / 2)].id, effect: "add", points: [2, 1, 0][i], reason: "" }); });
    m.scorecard = { title: "Your follow-up readiness", message: "This self-reported checklist highlights process opportunities. Unknown answers are left unscored; they are not treated as failures.", bands: [
      { id: "foundation", min: 0, max: 49, title: "Start with one dependable habit", advice: "You don’t need to fix everything at once. Start with the lowest-scoring category and give one improvement an owner.", action: "Choose one action below for this week.", ctaLabel: "", ctaUrl: "" },
      { id: "consistent", min: 50, max: 79, title: "Turn good intentions into a repeatable process", advice: "Some useful habits are already there. Focus on the places where follow-up still varies from person to person.", action: "Document one routine and review it next week.", ctaLabel: "", ctaUrl: "" },
      { id: "refine", min: 80, max: 100, title: "Refine what is already working", advice: "Your answers point to a strong foundation. Use real inquiry outcomes to test where a small improvement could matter.", action: "Review a recent sample before adding another tool.", ctaLabel: "", ctaUrl: "" },
    ] };
  } else {
    f.title = "What would help your business move forward?";
    f.description = "Get clearer on the kind of support that fits your next step. Five questions, with no pressure to book. Fictional advisory example.";
    f.questions = [
      question("priority", "What would make the next few months feel like progress?", ["Getting clear on what to focus on", "Understanding why one area feels stuck", "Putting a clear growth plan into action", "I’m not sure yet"]),
      question("stage", "How clear are you about the problem you want to solve?", ["I’m still exploring", "I can name one specific bottleneck", "I know the priority and need a plan", "It’s hard to say"]),
      question("support", "What kind of support would feel useful right now?", ["Something I can work through myself", "A focused outside perspective", "A collaborative planning conversation", "I don’t want support right now"]),
      question("timing", "When would you want to take a next step?", ["No timeline—I’m exploring", "In the next few months", "I’m ready to make time now", "I haven’t decided"]),
      question("readiness", "If a useful next step emerged, what could you commit to?", ["A small exercise on my own", "Preparing questions for a focused review", "Time to work on a plan with someone", "Nothing extra right now"]),
    ];
    m.outcomes = [
      { id: "self", title: "Start with a clarity exercise", description: "Give yourself space to choose one useful priority before taking on more support.", advice: "Write down the one change that would make the next month easier. List what you know, what you are assuming, and the smallest step you can try.", ctaLabel: "Explore the self-guided plan", ctaUrl: "", minPoints: 2 },
      { id: "review", title: "Focus on one bottleneck", description: "A focused review may help you see a specific problem from a new angle.", advice: "Bring one example, what you have already tried, and the question you want answered. A useful review should leave you with a clear next experiment.", ctaLabel: "Explore a focused review", ctaUrl: "", minPoints: 2 },
      { id: "plan", title: "Explore a planning conversation", description: "You may be ready to turn a clear priority into a practical sequence of actions.", advice: "Before booking, write down your objective, constraints, and who will implement the plan. Check the service scope and cost with the provider.", ctaLabel: "Explore a planning conversation", ctaUrl: "", minPoints: 2 },
    ];
    m.rules = [];
    for (const q of f.questions) for (let i = 0; i < 3; i++) m.rules.push({ id: `${q.id}-${i}`, questionId: q.id, answerId: `a${i}`, targetId: m.outcomes[i].id, effect: "add", points: q.id === "support" ? 20 : 1, reason: q.id === "support" ? ["You prefer to work through something yourself.", "You want a focused outside perspective.", "You want a collaborative planning conversation."][i] : "" });
    for (const target of m.outcomes) m.rules.push({ id: `no-support-${target.id}`, questionId: "support", answerId: "a3", targetId: target.id, effect: "exclude", points: 0, reason: "" });
    for (const targetId of ["review", "plan"]) m.rules.push({ id: `no-time-${targetId}`, questionId: "readiness", answerId: "a3", targetId, effect: "exclude", points: 0, reason: "" });
    m.fallbackTitle = "You can leave this here for now";
    m.fallbackMessage = "You don’t need to book anything to make this useful. Note the priority you chose and revisit it when you have space. If you are still unsure, start by describing what you want to be different.";
  }
  f.coverPage = { enabled: true, title: f.title, subtitle: f.description, buttonText: "Find my next step", estimatedMinutes: 2, showQuestionCount: true };
  f.marketing = MarketingSchema.parse(m);
  return FormSchema.parse(f);
}
