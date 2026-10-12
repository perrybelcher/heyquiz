import { requirePageUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";
import { parseExperimentEvidenceHandoff, type ExperimentEvidenceHandoff } from "@/lib/experiment-evidence";
import Experiments from "@/components/Experiments";
export const metadata = privateMetadata;
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  let handoff: ExperimentEvidenceHandoff | null = null, handoffError = "";
  try { handoff = parseExperimentEvidenceHandoff(query); }
  catch { handoffError = "The Results selection is invalid. Return to Results and choose the step again, or create a manual test below."; }
  return <Experiments handoff={handoff} handoffError={handoffError}/>;
}
