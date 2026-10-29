import CreatorInterface from "@/components/CreatorInterface";
import { privateMetadata } from "@/lib/seo";
export const metadata = privateMetadata;
export default function Layout({children}: {children: React.ReactNode}) { return <CreatorInterface>{children}</CreatorInterface>; }
