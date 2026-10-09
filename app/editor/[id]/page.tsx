import { notFound } from "next/navigation";
import { ownedForm, getPublishedForm } from "@/lib/storage";
import { requirePageUser } from "@/lib/auth";
import EditorStudio from "@/components/EditorStudio";
export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser(),
    { id } = await params,
    form = await ownedForm(id, user.id);
  if (!form) notFound();
  const published = await getPublishedForm(id);
  return <EditorStudio initialForm={form} initiallyPublished={Boolean(published)} />;
}
