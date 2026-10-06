// Ship the worker from the exact installed PDF.js version, on our own origin.
// The versioned URL prevents an older cached worker mixing with a new parser.
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const packagePath = require.resolve("pdfjs-dist/package.json");
const { version } = require(packagePath);
const output = new URL("../public/", import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(join(dirname(packagePath), "build/pdf.worker.min.mjs"), new URL(`pdf.worker.${version}.min.mjs`, output));
console.log(`Prepared PDF.js ${version} worker`);
