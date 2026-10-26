import { publicationFingerprint } from "@/lib/publication";
import { notFound } from "next/navigation";
import { ownedForm, getPublishedForm } from "@/lib/storage";
import { localMode, requirePageUser } from "@/lib/auth";
import EditorStudio from "@/components/EditorStudio";
import { editorSection } from "@/lib/editor-navigation";
export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { id } = await params,
    section = editorSection((await searchParams).section),
    user = await requirePageUser(`/editor/${id}${section === "edit" ? "" : `?section=${section}`}`),
    form = await ownedForm(id, user.id);
  if (!form) notFound();
  const published = await getPublishedForm(id);
  return <EditorStudio initialForm={form} initialSection={section} accountKey={user.accountKey} localSession={localMode()} sessionExpiresAt={user.expiresAt} initiallyPublished={Boolean(published)} publishedFingerprint={published ? publicationFingerprint(published) : ""} />;
}
