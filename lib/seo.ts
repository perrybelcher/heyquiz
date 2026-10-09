import type { Metadata } from "next";
export const SITE_URL = "https://www.pippiapp.com";
export const homeTitle = "Free Quiz Builder for Your Website | Pippi";
export const homeDescription = "Build interactive quizzes for your website. Capture leads, recommend products, and create personalized scorecards with Pippi. Start building free.";
export function publicMetadata(title: string, description: string, path: string): Metadata {
  return { title, description, alternates: { canonical: SITE_URL + path },
    openGraph: { type: "website", siteName: "Pippi", title, description, url: SITE_URL + path,
      images: [{url: SITE_URL + "/images/pippi-warm-products.webp", width:1536, height:1024, alt:"Products for a personalized recommendation quiz"}] },
    twitter: {card:"summary_large_image",title,description,images:[SITE_URL + "/images/pippi-warm-products.webp"]} };
}
export const privateMetadata: Metadata = { robots: { index:false, follow:false } };
