import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/lead-generation-quiz-builder", "/product-recommendation-quiz-builder", "/scorecard-builder"].map(path => ({url:SITE_URL + path}));
}
