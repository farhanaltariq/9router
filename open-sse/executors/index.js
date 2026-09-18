import { AntigravityExecutor } from "./antigravity.js";
import { GithubExecutor } from "./github.js";
import { CodexExecutor } from "./codex.js";
import { CommandCodeExecutor } from "./commandcode.js";
import { CodeBuddyExecutor } from "./codebuddy-cn.js";
import { CodeBuddyIntlExecutor } from "./codebuddy-intl.js";
import { DefaultExecutor } from "./default.js";

const executors = {
  antigravity: new AntigravityExecutor(),
  github: new GithubExecutor(),
  codex: new CodexExecutor(),
  commandcode: new CommandCodeExecutor(),
  "codebuddy-cn": new CodeBuddyExecutor(),
  "codebuddy-intl": new CodeBuddyIntlExecutor(),
};

const defaultCache = new Map();

export function getExecutor(provider) {
  if (executors[provider]) return executors[provider];
  if (!defaultCache.has(provider)) defaultCache.set(provider, new DefaultExecutor(provider));
  return defaultCache.get(provider);
}

export function hasSpecializedExecutor(provider) {
  return !!executors[provider];
}

export { BaseExecutor } from "./base.js";
export { AntigravityExecutor } from "./antigravity.js";
export { GithubExecutor } from "./github.js";
export { CodexExecutor } from "./codex.js";
export { DefaultExecutor } from "./default.js";
export { CommandCodeExecutor } from "./commandcode.js";
export { CodeBuddyExecutor } from "./codebuddy-cn.js";
export { CodeBuddyIntlExecutor } from "./codebuddy-intl.js";
