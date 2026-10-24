/** Keeps package.json, the runtime constants, the README, and the published files consistent. */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/constants.js";
import { DEFAULT_BASE_URL, PACKAGE_VERSION } from "../src/index.js";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const pkg = JSON.parse(read("package.json"));

function sourceFiles(dir: string): string[] {
  return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(`${dir}${entry.name}/`) : entry.name.endsWith(".ts") ? [`${dir}${entry.name}`] : [],
  );
}

describe("package metadata", () => {
  it("matches the runtime constants and the release contract", () => {
    expect(pkg.name).toBe(PACKAGE_NAME);
    expect(pkg.version).toBe(PACKAGE_VERSION);
    expect(pkg.license).toBe("MIT");
    expect(pkg.type).toBe("module");
    expect(pkg.exports["."]).toEqual({ types: "./dist/index.d.ts", default: "./dist/index.js" });
    expect(pkg.homepage).toBe("https://empiriolabs.ai");
    expect(pkg.repository).toEqual({
      type: "git",
      url: "git+https://github.com/EmpirioLabs-AI/langchain-empiriolabs-js.git",
    });
    expect(pkg.bugs.url).toBe("https://github.com/EmpirioLabs-AI/langchain-empiriolabs-js/issues");
    expect(pkg.author).toEqual({ name: "EmpirioLabs AI", email: "support@empiriolabs.ai", url: "https://empiriolabs.ai" });
    expect(pkg.publishConfig.access).toBe("public");
    expect(pkg.engines.node).toBe(">=22");
    expect(pkg.keywords).toEqual(expect.arrayContaining(["langchain", "langchainjs", "empiriolabs"]));
    expect(DEFAULT_BASE_URL).toBe("https://api.empiriolabs.ai/v1");
  });

  it("depends only on @langchain/openai and takes @langchain/core as a peer", () => {
    expect(pkg.dependencies).toEqual({ "@langchain/openai": "^1.7.0" });
    expect(pkg.peerDependencies).toEqual({ "@langchain/core": "^1.3.0" });
  });

  it("publishes only the build, the README, the changelog, and the license", () => {
    expect(pkg.files).toEqual(["dist/**/*.js", "dist/**/*.d.ts", "README.md", "CHANGELOG.md", "LICENSE"]);
  });
});

describe("user-facing text", () => {
  const files = ["README.md", "CHANGELOG.md", "LICENSE", "package.json", ...sourceFiles("src/")];

  it("uses no em dash", () => {
    const emDash = String.fromCharCode(0x2014);
    for (const file of files) {
      expect(read(file), file).not.toContain(emDash);
    }
  });

  it("names the legal entity in the license and the brand everywhere else", () => {
    expect(read("LICENSE")).toContain("Copyright (c) 2026 EmpirioLabs.ai LLC");
    for (const file of ["README.md", "CHANGELOG.md", "package.json"]) {
      expect(read(file), file).toContain("EmpirioLabs AI");
      expect(read(file), file).not.toMatch(/Empirio Labs|EmpirioLabs\.ai LLC/u);
    }
  });

  it("documents the current version in the changelog", () => {
    expect(read("CHANGELOG.md")).toContain(`## ${PACKAGE_VERSION}`);
  });
});
