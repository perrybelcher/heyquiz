import { notFound } from "next/navigation";
import { getPublishedForm, ownedForm } from "@/lib/storage";
import { currentUser } from "@/lib/auth";
import { publicForm } from "@/lib/engine";
import QuizPlayer from "@/components/QuizPlayer";
export const dynamic = "force-dynamic";
export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params,
    preview = (await searchParams).preview === "1",
    user = preview ? await currentUser() : null;
  const form =
    preview && user
      ? await ownedForm(id, user.id)
      : !preview
        ? await getPublishedForm(id)
        : null;
  if (!form) notFound();
  return <QuizPlayer form={publicForm(form)} preview={preview} />;
}
