import type { MetadataRoute } from "next";
import { helpArticles } from "@/lib/help-content";
import { SITE_URL } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/lead-generation-quiz-builder", "/product-recommendation-quiz-builder", "/scorecard-builder", "/help", ...helpArticles.map(a => `/help/${a.slug}`)].map(path => ({url:SITE_URL + path}));
}
