import { requirePageUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";
import Experiments from "@/components/Experiments";
export const metadata = privateMetadata;
export default async function Page() { await requirePageUser(); return <Experiments/>; }
