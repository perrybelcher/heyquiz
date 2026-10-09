import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
// Leave HTML crawlable so crawlers can read each route's noindex directive.
export default function robots(): MetadataRoute.Robots {
  return {rules:{userAgent:"*",allow:"/"}, sitemap:SITE_URL + "/sitemap.xml"};
}
