import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { getPublishedForm, ownedForm } from "@/lib/storage";
import { currentUser } from "@/lib/auth";
import { publicForm } from "@/lib/engine";
import QuizPlayer from "@/components/QuizPlayer";
export const dynamic = "force-dynamic";
type Props = {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        preview?: string;
        embed?: string;
    }>;
};
// Request-scoped memoization shares the same authorized snapshot with metadata.
const resolveForm = cache(async (id: string, preview: boolean) => {
    if (!preview)
        return getPublishedForm(id);
    const user = await currentUser();
    return user ? ownedForm(id, user.id) : null;
});
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
    const form = await resolveForm((await params).id, (await searchParams).preview === "1");
    if (!form)
        return { title: "Quiz unavailable", icons: { icon: "/quiz-icon.svg" } };
    return {
        title: form.title,
        description: form.coverPage?.enabled ? form.coverPage.subtitle || "Take this quiz." : "Take this quiz.",
        icons: { icon: form.theme.logoUrl || (form.theme.hidePippiBranding ? "/quiz-icon.svg" : "/pippi-logo.svg") },
    };
}
export default async function PlayPage({ params, searchParams }: Props) {
    const query = await searchParams;
    const preview = query.preview === "1";
    const form = await resolveForm((await params).id, preview);
    if (!form)
        notFound();
    return <QuizPlayer form={publicForm(form)} preview={preview} embed={query.embed === "1"}/>;
}
