import type { Attempt } from "./attempts";
import type { QuizSubmissionResult } from "./schema";
import { listRecords, readRecord } from "./records";
import { projectContactContext, type ContactContexts } from "./contact-context";
import { createContactAnswerCollector } from "./contact-answer-cohort-server";
import type { ContactAnswerPair } from "./contact-answer-cohort";

/** The route checks quiz ownership first. A retained submission is the only source
 * of a contact; matching emails and cached attempt results never recreate one. */
export async function loadContactDirectory(formId: string, owner: string, now = Date.now(), answerPair: ContactAnswerPair | null = null) {
  const records = (await listRecords<QuizSubmissionResult>("submissions", owner))
    .filter(row => row.owner_id === owner && row.payload.formId === formId && row.payload.contact)
    .sort((a, b) => b.payload.submittedAt.localeCompare(a.payload.submittedAt) || a.id.localeCompare(b.id));
  // Canonical record IDs prevent a malformed legacy payload ID targeting another response.
  const contacts = records.map(row => ({ ...row.payload, id: row.id }));
  const contextByResponse: ContactContexts = Object.create(null);
  const answers = createContactAnswerCollector(answerPair);
  let next = 0, failed = false;
  await Promise.all(Array.from({ length: Math.min(8, contacts.length) }, async () => {
    while (!failed) {
      const index = next++;
      if (index >= contacts.length) return;
      const row = contacts[index];
      try {
        const retained = await readRecord<Attempt>("attempts", row.id);
        const attempt = retained?.id === row.id && retained.owner_id === owner && retained.payload.form?.id === formId && retained.payload.preview === false ? retained.payload : undefined;
        contextByResponse[row.id] = projectContactContext(row, attempt, now);
        answers.add(row, attempt);
      } catch { failed = true; }
    }
  }));
  // A missing record is normal history loss. A failed read is an error, never an
  // apparently successful all-unknown cohort that could then be exported.
  if (failed) throw Error("Contact history could not be loaded. Try refreshing.");
  return { contacts, contextByResponse, answerCohort: answers.finish() };
}
