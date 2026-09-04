import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ChatCompletion } from "groq-sdk/resources/chat/completions";

import {
  getGroqText,
  getGroqToolInput,
  getGroqUsage,
} from "../../src/lib/ai/groq-response";

const read = (path: string) => readFileSync(path, "utf8");

test("Groq est l'unique fournisseur SDK des fonctionnalités IA", () => {
  const packageJson = read("package.json");
  const client = read("src/lib/ai/client.ts");
  const models = read("src/lib/ai/models.ts");

  assert.match(packageJson, /"groq-sdk"/);
  assert.doesNotMatch(packageJson, /@anthropic-ai\/sdk/);
  assert.match(client, /import Groq from "groq-sdk"/);
  assert.match(client, /process\.env\.GROQ_API_KEY/);
  assert.doesNotMatch(client, /ANTHROPIC_API_KEY/);
  assert.match(models, /openai\/gpt-oss-120b/);
  assert.match(models, /openai\/gpt-oss-20b/);
});

test("les réponses Groq sont centralisées, mesurées et désérialisées sans lever", () => {
  const responseSource = read("src/lib/ai/groq-response.ts");

  assert.match(responseSource, /response\.choices\[0\]\?\.message\.content/);
  assert.match(responseSource, /message\.tool_calls\?\.find/);
  assert.match(responseSource, /JSON\.parse\(call\.function\.arguments\)/);
  assert.match(responseSource, /catch \{/);
  assert.match(responseSource, /usage\?\.prompt_tokens/);
  assert.match(responseSource, /usage\?\.completion_tokens/);
  assert.match(responseSource, /prompt_tokens_details\?\.cached_tokens/);
});

test("les adaptateurs Groq traitent texte, outils, métriques et JSON invalide", () => {
  const response: ChatCompletion = {
    id: "completion-test",
    object: "chat.completion",
    created: 0,
    model: "openai/gpt-oss-20b",
    choices: [
      {
        index: 0,
        finish_reason: "tool_calls",
        logprobs: null,
        message: {
          role: "assistant",
          content: "  Réponse utile  ",
          tool_calls: [
            {
              id: "call-valid",
              type: "function",
              function: { name: "repondre", arguments: '{"ok":true}' },
            },
            {
              id: "call-invalid",
              type: "function",
              function: { name: "invalide", arguments: "{" },
            },
          ],
        },
      },
    ],
    usage: {
      prompt_tokens: 42,
      completion_tokens: 8,
      total_tokens: 50,
      prompt_tokens_details: { cached_tokens: 32 },
    },
  };

  assert.equal(getGroqText(response), "Réponse utile");
  assert.deepEqual(getGroqToolInput(response, "repondre"), { ok: true });
  assert.equal(getGroqToolInput(response, "invalide"), null);
  assert.equal(getGroqToolInput(response, "absent"), null);
  assert.deepEqual(getGroqUsage(response), {
    inputTokens: 42,
    outputTokens: 8,
    cacheReadTokens: 32,
  });
});

test("chaque sortie structurée Groq est forcée puis validée côté serveur", () => {
  for (const helper of [
    "assistant",
    "quiz-generator",
    "review-moderation",
    "seo-suggestions",
  ]) {
    const source = read(`src/lib/ai/${helper}.ts`);
    assert.match(source, /tool_choice: \{/);
    assert.match(source, /type: "function"/);
    assert.match(source, /safeParse\(/);
  }
});

test("les surfaces de configuration n'attendent plus de clé Anthropic", () => {
  const sources = [
    ".env.example",
    ".env.production.example",
    "README.md",
    "src/lib/env.ts",
    "src/app/layout.tsx",
    "src/app/admin/assistant/page.tsx",
    "tests/e2e/assistant.spec.ts",
    "tests/e2e/assistant-security.spec.ts",
  ].map(read);

  for (const source of sources) {
    assert.match(source, /GROQ_API_KEY/);
    assert.doesNotMatch(source, /ANTHROPIC_API_KEY/);
  }
});
