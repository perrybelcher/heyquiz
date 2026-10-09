import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime records and QA artifacts belong to local storage, never a deployed
  // function bundle. Cloud deployments read records from the configured DB.
  outputFileTracingExcludes: {
    "/*": ["./.heyquiz-data/**/*", "./.env*", "./tests/**/*", "./coverage/**/*"],
  },
  async headers() {
    return [{source:"/api/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"}]}];
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
