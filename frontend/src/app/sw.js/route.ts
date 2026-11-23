import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Next generates this response once per build. Every deployment gets a new
// worker revision even when the worker template itself has not changed.
export const dynamic = "force-static";

export async function GET() {
  const source = await readFile(join(process.cwd(), "src/pwa/service-worker.js"), "utf8");
  return new Response(`const BUILD_VERSION = ${JSON.stringify(new Date().toISOString())};\n${source}`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Service-Worker-Allowed": "/",
    },
  });
}
