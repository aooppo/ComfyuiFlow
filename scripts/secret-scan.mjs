import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", "dist", "coverage", "var"]);
const patterns = [
  { name: "OpenAI-style key", value: new RegExp("s" + "k-(?:proj-)?[A-Za-z0-9_-]{20,}", "g") },
  {
    name: "assigned provider key",
    value: new RegExp("(?:OPENAI|DASHSCOPE)_API_KEY\\s*=\\s*[^\\s#]{12,}", "g"),
  },
  { name: "private key", value: new RegExp("BEGIN " + "(?:RSA |EC |OPENSSH )?PRIVATE KEY", "g") },
];

async function files(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await files(path)));
    else output.push(path);
  }
  return output;
}

const findings = [];
for (const path of await files(root)) {
  const bytes = await readFile(path);
  if (bytes.byteLength > 1_000_000 || bytes.includes(0)) continue;
  const text = bytes.toString("utf8");
  for (const pattern of patterns) {
    pattern.value.lastIndex = 0;
    if (pattern.value.test(text)) findings.push(`${relative(root, path)}: ${pattern.name}`);
  }
}

if (findings.length > 0) {
  process.stderr.write(`Potential committed secrets found:\n${findings.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Secret scan passed.\n");
}
