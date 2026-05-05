import { relative, resolve, sep } from "node:path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import webExtension, { readJsonFile } from "vite-plugin-web-extension";

import tailwindcss from "@tailwindcss/vite";

const ENV_FILES_TO_WATCH = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
];

function toOriginMatchPattern(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return `${new URL(value).origin}/*`;
  } catch {
    return null;
  }
}

function mergeMatchPatterns(
  patterns: string[] | undefined,
  extraPattern: string | null,
): string[] {
  const existingPatterns = Array.isArray(patterns) ? patterns : [];

  if (!extraPattern) {
    return existingPatterns;
  }

  return [...new Set([...existingPatterns, extraPattern])];
}

function mergeManyMatchPatterns(
  patterns: string[] | undefined,
  extraPatterns: Array<string | null>,
): string[] {
  return extraPatterns.reduce(
    (mergedPatterns, extraPattern) =>
      mergeMatchPatterns(mergedPatterns, extraPattern),
    patterns ?? [],
  );
}

function generateManifest(mode: string) {
  const manifest = readJsonFile("public/manifest.json");
  const pkg = readJsonFile("package.json");
  const env = loadEnv(mode, process.cwd(), "");
  const webappOriginMatch = toOriginMatchPattern(env.VITE_WEBAPP_URL);
  const apiOriginMatch = toOriginMatchPattern(env.VITE_API_URL);
  const wsOriginMatch = toOriginMatchPattern(env.VITE_WS_URL);

  return {
    ...manifest,
    version: pkg.version, // Single source of truth for version
    content_scripts: Array.isArray(manifest.content_scripts)
      ? manifest.content_scripts.map(
          (script: { matches?: string[]; [key: string]: unknown }) => ({
            ...script,
            matches: mergeMatchPatterns(script.matches, webappOriginMatch),
          }),
        )
      : manifest.content_scripts,
    host_permissions: mergeManyMatchPatterns(manifest.host_permissions, [
      webappOriginMatch,
      apiOriginMatch,
      wsOriginMatch,
    ]),
  };
}

function getEntryFileName(facadeModuleId?: string | null) {
  if (!facadeModuleId) return "[name].js";

  return relative(import.meta.dirname, facadeModuleId)
    .split(sep)
    .join("/")
    .replace(/\.[^.]+$/, ".js");
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    webExtension({
      manifest: () => generateManifest(mode),
      additionalInputs: [
        "src/background/index.ts",
        "src/content/index.tsx",
        "src/offscreen/index.html",
        "src/request-mic/index.html",
      ],
      watchFilePaths: [
        "public/manifest.json",
        "package.json",
        ...ENV_FILES_TO_WATCH,
      ],
      browser: "chrome",
      htmlViteConfig: {
        // Vite config applied only to HTML entry points (popup, options, etc.)
        build: {
          // Chunking strategy for UI entries
          rollupOptions: {
            output: {
              // Predictable chunk names — important for manifest resource refs
              chunkFileNames: "shared/[name]-[hash].js",
            },
          },
        },
      },
    }),
  ],

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== "production",
    minify: "esbuild",
    target: "es2023", // Chrome 100+ supports all ES2023 features
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Keep source-relative directories so manifest-managed entrypoints
        // resolve to paths like src/background/index.js in the final build.
        entryFileNames: (chunkInfo) =>
          getEntryFileName(chunkInfo.facadeModuleId),
        chunkFileNames: "shared/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },

  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@shared": resolve(import.meta.dirname, "./src/shared"),
    },
  },
}));
