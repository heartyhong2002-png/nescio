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
    const key = match[1];
    // 같은 키가 여러 번 나오면 첫 번째 값을 유지한다. 실수로 아래에 덧붙인 잘못된 값이
    // 정상 키를 덮어써서 조용히 API가 죽는 사고를 막는다.
    if (key in notebookEnv) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2").trim();
    if (!value) continue; // 빈 값은 "설정 안 함"으로 취급
    notebookEnv[key] = value;
  }
  return notebookEnv;
}

export function serverEnv(name: string) {
  return process.env[name] || readNotebookEnv()[name];
}
