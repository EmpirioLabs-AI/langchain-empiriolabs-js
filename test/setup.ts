/**
 * Unit tests never reach the network and never see a real API key: the global fetch throws,
 * and the EmpirioLabs AI and OpenAI environment variables start blank.
 */
import { afterEach, beforeEach, vi } from "vitest";

const BLANK_ENV = [
  "EMPIRIOLABS_API_KEY",
  "EMPIRIOLABS_API_BASE",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_API_BASE",
  "OPENAI_ORG_ID",
  "OPENAI_ORGANIZATION",
  "OPENAI_PROJECT_ID",
];

beforeEach(() => {
  for (const name of BLANK_ENV) vi.stubEnv(name, "");
  vi.stubGlobal("fetch", () => {
    throw new Error("Unit tests must not use the network; pass a fetch double in configuration.fetch.");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
