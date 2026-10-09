import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime records and QA artifacts belong to local storage, never a deployed
  // function bundle. Cloud deployments read records from the configured DB.
  outputFileTracingExcludes: {
    "/*": ["./.heyquiz-data/**/*", "./.env*", "./tests/**/*", "./coverage/**/*"],
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
