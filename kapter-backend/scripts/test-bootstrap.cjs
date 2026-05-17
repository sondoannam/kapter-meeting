const Module = require("node:module");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const compiledPrismaClient = path.join(
  packageRoot,
  ".test-dist",
  "prisma",
  "generated",
  "prisma",
  "client.js",
);

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request === "prisma/generated/prisma/client") {
    return compiledPrismaClient;
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
