import { localMode } from "@/lib/auth";
import Login from "@/components/Login";
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const query = await searchParams;
  return <Login local={localMode()} reset={query.reset === "success"} />;
}
