import fs from "node:fs";
import path from "node:path";

let notebookEnv: Record<string, string> | undefined;

function readNotebookEnv() {
  if (notebookEnv) return notebookEnv;
  notebookEnv = {};
  const envPath = path.join(process.cwd(), "notebooks", ".env");
  if (!fs.existsSync(envPath)) return notebookEnv;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    notebookEnv[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return notebookEnv;
}

export function serverEnv(name: string) {
  return process.env[name] || readNotebookEnv()[name];
}
