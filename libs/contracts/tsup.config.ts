import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: [
    "src/index.ts",
    "src/audio-stream.ts",
    "src/domain.ts",
    "src/worker.ts",
  ],
  format: ["esm", "cjs"],
  sourcemap: true,
  target: "es2022",
});
