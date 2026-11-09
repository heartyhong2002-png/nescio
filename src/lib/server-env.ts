import fs from "node:fs";
import path from "node:path";

let notebookEnv: Record<string, string> | undefined;

function readNotebookEnv() {
  if (notebookEnv) return notebookEnv;
  notebookEnv = {};
  const envPath = path.join(process.cwd(), "tools", "notebooks", ".env");
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

/**
 * Groq 서빙 모델을 검증하여 반환한다.
 * llama-3.3-70b-versatile, llama-3.1-8b 등 Groq에서 삭제된 레거시 모델 또는 미지정 시,
 * Groq에서 공식 서빙하는 고성능 모델인 OpenAI의 GPT-OSS 120B(openai/gpt-oss-120b)로 자동 설정한다.
 */
export function resolveGroqModel(): string {
  const model = serverEnv("GROQ_MODEL");
  if (!model || model.includes("llama-3") || model.includes("llama3") || model.includes("qwen")) {
    return "openai/gpt-oss-120b";
  }
  return model;
}

/**
 * Gemini 서빙 모델을 검증하여 반환한다.
 * 2.5/2.0/1.5는 404로 폐기되었고, 3.8-flash는 트래픽 과부하(503/timeout)가 잦으므로
 * 1초대로 응답이 가장 안정적인 gemini-3.5-flash-lite를 기본값으로 사용한다.
 */
export function resolveGeminiModel(): string {
  const model = serverEnv("GEMINI_MODEL");
  if (!model || model.includes("2.5") || model.includes("1.5") || model.includes("2.0") || model === "gemini-3.8-flash") {
    return "gemini-3.5-flash-lite";
  }
  return model;
}

