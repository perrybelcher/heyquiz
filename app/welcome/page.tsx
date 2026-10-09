import SalesPage from "@/components/SalesPage";
import { publicMetadata, homeTitle, homeDescription } from "@/lib/seo";
// Keep the signed-in marketing view, but consolidate duplicate search signals.
export const metadata = publicMetadata(homeTitle, homeDescription, "/");
export default function WelcomePage() { return <SalesPage />; }
