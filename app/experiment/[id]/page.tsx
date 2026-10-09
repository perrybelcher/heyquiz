import ExperimentPlayer from "@/components/ExperimentPlayer";
import { privateMetadata } from "@/lib/seo";
export const metadata = privateMetadata;
export default async function Page({ params }: { params:Promise<{id:string}> }) {
  const {id} = await params;
  return <ExperimentPlayer id={id}/>;
}
