import type { FormSchemaType, Question } from "./schema";
import { MarketingSchema, type MarketingConfig } from "./marketing";
export function marketingTemplate(
  kind: MarketingConfig["kind"],
  id: string,
): FormSchemaType {
  const question = (
    qid: string,
    title: string,
    labels: string[],
  ): Question => ({
    id: qid,
    type: "multiple_choice",
    title,
    required: true,
    points: 0,
    options: labels.map((label, i) => ({ id: `a${i}`, label })),
  });
  const base: FormSchemaType = {
    id,
    title: "",
    description:
      "Fictional example. Edit the questions and results to fit your business.",
    mode: "survey",
    theme: {
      primaryColor: "#4f46e5",
      backgroundColor: "#f6f7fb",
      cardColor: "#ffffff",
      borderRadius: "lg",
    },
    settings: {
      showProgressBar: true,
      showReviewBeforeSubmit: true,
      allowRetake: true,
      feedbackMode: "end",
      showAnswerKeyOnFinish: false,
    },
    questions: [],
    outcomeTiers: [],
  };
  const m = MarketingSchema.parse({ kind });
  if (kind === "scorecard") {
    base.title = "How ready is your follow-up process?";
    base.questions = [
      question(
        "capture",
        "Do new inquiries arrive in one place your team can check?",
        ["Yes, consistently", "Some of the time", "Not yet", "Not sure"],
      ),
      question(
        "followup",
        "Does every new inquiry have a clear owner and next step?",
        ["Yes, consistently", "Some of the time", "Not yet", "Not sure"],
      ),
      question("measure", "Do you review which inquiries become customers?", [
        "Yes, regularly",
        "Occasionally",
        "Not yet",
        "Not sure",
      ]),
    ];
    m.categories = [
      {
        id: "operations",
        title: "Inquiry handling",
        description:
          "Choose one shared place for inquiries, then assign an owner and a next action. This is a self-report checklist, not a prediction of sales.",
        minAnswers: 2,
      },
      {
        id: "measurement",
        title: "Measurement",
        description:
          "Start with a simple count of inquiries and resulting customers over the same period.",
        minAnswers: 1,
      },
    ];
    for (const q of base.questions)
      for (let i = 0; i < 3; i++)
        m.rules.push({
          id: `${q.id}-${i}`,
          questionId: q.id,
          answerId: `a${i}`,
          targetId: q.id === "measure" ? "measurement" : "operations",
          effect: "add",
          points: [2, 1, 0][i],
          reason: "",
        });
  } else if (kind === "product_finder") {
    base.title = "Find your everyday carry";
    base.questions = [
      question("use", "What does your bag usually need to carry?", [
        "A few daily essentials",
        "A laptop and work essentials",
        "Clothes for a short trip",
        "Not sure yet",
      ]),
      question("priority", "What would make getting out the door easier?", [
        "Keeping things light",
        "Having a place for everything",
        "Room for a change of plans",
        "I’m still deciding",
      ]),
      question("fit", "Does your bag need to carry a 17-inch laptop?", [
        "Yes",
        "No",
        "Not sure",
      ]),
    ];
    m.outcomes = [
      {
        id: "light",
        title: "The Everyday Sling",
        description: "A fictional compact bag for your everyday essentials.",
        advice:
          "Lay out what you carry most days. Check that the essentials fit without adding items you rarely use.",
        ctaLabel: "Explore the sling",
        ctaUrl: "",
        minPoints: 2,
      },
      {
        id: "work",
        title: "The Workday Pack",
        description:
          "A fictional organized pack with space for a laptop up to 15 inches.",
        advice:
          "Measure your laptop and compare it with the compartment dimensions before choosing.",
        ctaLabel: "Explore the pack",
        ctaUrl: "",
        minPoints: 2,
      },
      {
        id: "travel",
        title: "The Weekend Tote",
        description:
          "A fictional roomy carryall for clothing and flexible plans. It has no dedicated laptop protection.",
        advice:
          "Make a short packing list and check the packed size against your travel requirements.",
        ctaLabel: "Explore the tote",
        ctaUrl: "",
        minPoints: 2,
      },
    ];
    for (let i = 0; i < 3; i++) {
      const target = m.outcomes[i];
      m.rules.push({
        id: `use-${i}`,
        questionId: "use",
        answerId: `a${i}`,
        targetId: target.id,
        effect: "add",
        points: 3,
        reason: [
          "You said you carry a few daily essentials.",
          "You said you carry a laptop and work essentials.",
          "You said you carry clothes for a short trip.",
        ][i],
      });
      m.rules.push({
        id: `priority-${i}`,
        questionId: "priority",
        answerId: `a${i}`,
        targetId: target.id,
        effect: "add",
        points: 2,
        reason: [
          "Keeping things light is your priority.",
          "You want a place for everything.",
          "You want room for a change of plans.",
        ][i],
      });
      m.rules.push({
        id: `exclude-${i}`,
        questionId: "fit",
        answerId: "a0",
        targetId: target.id,
        effect: "exclude",
        points: 0,
        reason: "",
      });
    }
    m.fallbackTitle = "Let’s check the fit first";
    m.fallbackMessage =
      "These example products do not cover every need. For a 17-inch laptop, look for a bag with a specifically rated protective compartment. If you are unsure, list your essentials before choosing.";
  } else {
    base.title = "Find your next baking step";
    base.questions = [
      question("experience", "Where are you with baking bread?", [
        "Getting ready for my first loaf",
        "I’ve tried a few times",
        "I bake regularly",
        "I’m just exploring",
      ]),
      question("benefit", "What would make your next bake feel like a win?", [
        "A loaf I’m proud to put on the table",
        "Fewer ingredients wasted on disappointing attempts",
        "A routine that fits my day",
        "I’m still figuring that out",
      ]),
      question("help", "What kind of help would feel most useful?", [
        "A clear first-bake walkthrough",
        "Help understanding what went wrong",
        "A plan I can fit around my schedule",
        "I’d rather explore on my own",
      ]),
    ];
    m.outcomes = [
      {
        id: "beginner",
        title: "Your first-loaf path",
        description: "Start with one approachable recipe and a clear sequence.",
        advice:
          "Read the recipe all the way through and check the equipment before mixing. Keep notes so your next attempt builds on the first.",
        ctaLabel: "Explore beginner lessons",
        ctaUrl: "",
        minPoints: 2,
      },
      {
        id: "troubleshoot",
        title: "Your troubleshooting path",
        description:
          "Focus on one part of the bake you want to understand better.",
        advice:
          "Write down what happened and change one variable on your next attempt. That makes the result easier to interpret.",
        ctaLabel: "Explore troubleshooting lessons",
        ctaUrl: "",
        minPoints: 2,
      },
      {
        id: "routine",
        title: "Your baking-routine path",
        description: "Build a process around the time you actually have.",
        advice:
          "Work backward from when you want to bake, allowing for the timing and signs described in your recipe.",
        ctaLabel: "Explore planning lessons",
        ctaUrl: "",
        minPoints: 2,
      },
    ];
    for (let i = 0; i < 3; i++) {
      const target = m.outcomes[i];
      m.rules.push({
        id: `help-${i}`,
        questionId: "help",
        answerId: `a${i}`,
        targetId: target.id,
        effect: "add",
        points: 3,
        reason: [
          "You asked for a clear first-bake walkthrough.",
          "You asked for help understanding what went wrong.",
          "You asked for a plan that fits your schedule.",
        ][i],
      });
      m.rules.push({
        id: `benefit-${i}`,
        questionId: "benefit",
        answerId: `a${i}`,
        targetId: target.id,
        effect: "add",
        points: 1,
        reason: [
          "You want a loaf you’re proud to share.",
          "You chose less waste as your priority.",
          "A routine that fits your day matters to you.",
        ][i],
      });
      m.rules.push({
        id: `own-${i}`,
        questionId: "help",
        answerId: "a3",
        targetId: target.id,
        effect: "exclude",
        points: 0,
        reason: "",
      });
    }
    m.fallbackTitle = "Explore at your own pace";
    m.fallbackMessage =
      "Choose a recipe that interests you and make one small attempt. You don’t need to select a course to get started.";
  }
  return { ...base, marketing: m };
}
