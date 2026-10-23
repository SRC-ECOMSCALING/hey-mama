// Builds the app for Vercel via the Build Output API (.vercel/output):
// the Vite client becomes static files and the Express API becomes a single
// bundled Node function. Run by Vercel as the project's build command.
import { execSync } from "node:child_process";
import fs from "node:fs";
import { build } from "esbuild";

const out = ".vercel/output";
const func = `${out}/functions/api.func`;

fs.rmSync(out, { recursive: true, force: true });

execSync("npx vite build", { stdio: "inherit" });
fs.cpSync("dist/public", `${out}/static`, { recursive: true });
// Demo/seed profile images referenced as /attached_assets/...
fs.cpSync("attached_assets", `${out}/static/attached_assets`, { recursive: true });

await build({
  entryPoints: ["server/vercel.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: `${func}/index.mjs`,
  // pg's optional native binding; never installed.
  external: ["pg-native"],
  // NODE_ENV can't be set on the Vercel project (npm install would then skip
  // devDependencies such as vite and esbuild), so fix it in the bundle:
  // production-only behavior like the secure session cookie relies on it.
  define: { "process.env.NODE_ENV": '"production"' },
  // Bundled CommonJS dependencies call require(): give the ESM bundle one.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});

fs.writeFileSync(
  `${func}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      maxDuration: 60,
      // Next to the Supabase database (eu-central-1).
      regions: ["fra1"],
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "^/(api|objects)(/.*)?$", dest: "/api" },
        // Client-side routes (wouter): every other path loads the SPA.
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("Vercel build output ready in", out);
