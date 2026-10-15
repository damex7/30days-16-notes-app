import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (the Next.js 16.4 default): nothing is cached unless a
  // function says 'use cache'. lib/notes.ts caches each query and tags it, and
  // the Server Actions in app/(app)/actions.ts expire exactly those tags after
  // a write. Anything that reads the request must sit inside <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Pin the project root: there is an unrelated package-lock.json higher up
    // in the home folder that Turbopack would otherwise consider.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
