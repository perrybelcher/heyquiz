import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime records and QA artifacts belong to local storage, never a deployed
  // function bundle. Cloud deployments read records from the configured DB.
  outputFileTracingExcludes: {
    "/*": ["./.heyquiz-data/**/*", "./.env*", "./data/**/*", "./docs/**/*", "./tests/**/*", "./coverage/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/result/*/pdf": ["./assets/pdf-fonts/*"],
  },
  async headers() {
    return [{source:"/api/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"}]}];
  },
  // Use the same Tailwind loader for the isolated webpack QA build.
  // Without this, webpack emits the Tailwind import but no utility classes.
  webpack(config) {
    // Extend Next's existing CSS chain rather than adding a CSS rule (which
    // would disable Next's built-in CSS handling).
    type CssRule = { oneOf?: CssRule[]; use?: (string | { loader?: string })[] };
    const visit = (rules: CssRule[]) => {
      for (const rule of rules) {
        if (!rule || typeof rule !== "object") continue;
        if (rule.oneOf) visit(rule.oneOf);
        if (Array.isArray(rule.use) && rule.use.some(entry => entry && typeof entry === "object" && "loader" in entry && String(entry.loader).includes("postcss-loader"))) {
          rule.use.push({ loader: "@tailwindcss/turbopack" });
        }
      }
    };
    visit(config.module.rules);
    return config;
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
