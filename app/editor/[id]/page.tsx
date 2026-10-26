import { publicationFingerprint } from "@/lib/publication";
import { notFound } from "next/navigation";
import { ownedForm, getPublishedForm } from "@/lib/storage";
import { localMode, requirePageUser } from "@/lib/auth";
import EditorStudio from "@/components/EditorStudio";
export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    user = await requirePageUser(`/editor/${id}`),
    form = await ownedForm(id, user.id);
  if (!form) notFound();
  const published = await getPublishedForm(id);
  return <EditorStudio initialForm={form} accountKey={user.accountKey} localSession={localMode()} sessionExpiresAt={user.expiresAt} initiallyPublished={Boolean(published)} publishedFingerprint={published ? publicationFingerprint(published) : ""} />;
}
