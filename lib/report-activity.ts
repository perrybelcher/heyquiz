import type { QuizSubmissionResult } from "./schema";

/** One owner-scoped scan, with no contact details sent to the overview. */
export function reportActivity(submissions: QuizSubmissionResult[]) {
  const activity = new Map<string, { responseCount: number; latestResponseAt?: string }>();
  for (const submission of submissions) {
    const entry = activity.get(submission.formId) || { responseCount: 0 };
    entry.responseCount++;
    const date = Date.parse(submission.submittedAt);
    if (Number.isFinite(date) && (!entry.latestResponseAt || date > Date.parse(entry.latestResponseAt)))
      entry.latestResponseAt = submission.submittedAt;
    activity.set(submission.formId, entry);
  }
  return activity;
}
