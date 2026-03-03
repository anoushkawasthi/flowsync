import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Auto-detect project metadata from the workspace.
 * Used to pre-fill the init form and reduce manual entry.
 */

export interface DetectedMetadata {
  name: string | null;
  description: string | null;
  languages: string[];
  frameworks: string[];
  defaultBranch: string;
}

/**
 * Detect project name from various config files, fallback to folder name.
 */
export function detectProjectName(workspaceRoot: string): string | null {
  // 1. Try package.json (Node.js/TypeScript)
  const packageJson = path.join(workspaceRoot, "package.json");
  if (fs.existsSync(packageJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJson, "utf-8"));
      if (pkg.name) return sanitizeName(pkg.name);
    } catch {
      // ignore parse errors
    }
  }

  // 2. Try pyproject.toml (Python)
  const pyproject = path.join(workspaceRoot, "pyproject.toml");
  if (fs.existsSync(pyproject)) {
    try {
      const content = fs.readFileSync(pyproject, "utf-8");
      const match = content.match(/^\[project\]\s*\nname\s*=\s*"([^"]+)"/m);
      if (match) return sanitizeName(match[1]);
    } catch {
      // ignore
    }
  }

  // 3. Try Cargo.toml (Rust)
  const cargo = path.join(workspaceRoot, "Cargo.toml");
  if (fs.existsSync(cargo)) {
    try {
      const content = fs.readFileSync(cargo, "utf-8");
      const match = content.match(/^\[package\]\s*\nname\s*=\s*"([^"]+)"/m);
      if (match) return sanitizeName(match[1]);
    } catch {
      // ignore
    }
  }

  // 4. Try go.mod (Go)
  const gomod = path.join(workspaceRoot, "go.mod");
  if (fs.existsSync(gomod)) {
    try {
      const content = fs.readFileSync(gomod, "utf-8");
      const match = content.match(/^module\s+(.+)$/m);
      if (match) {
        const moduleName = match[1].trim();
        // go modules are often full paths, take the last segment
        const parts = moduleName.split("/");
        return sanitizeName(parts[parts.length - 1]);
      }
    } catch {
      // ignore
    }
  }

  // 5. Fallback: workspace folder name
  return sanitizeName(path.basename(workspaceRoot));
}

/**
 * Detect languages by scanning the workspace root, src/, and all immediate
 * child directories (monorepo support: frontend/, backend/, etc.).
 */
export function detectLanguages(workspaceRoot: string): string[] {
  const languages = new Set<string>();
  const dirs = getSearchDirs(workspaceRoot);

  const anyDirHas = (ext: string) => dirs.some((d) => hasFilesWithExtension(d, ext));
  const anyDirHasFile = (name: string) => dirs.some((d) => fs.existsSync(path.join(d, name)));

  // TypeScript
  const hasTypeScript =
    anyDirHasFile("tsconfig.json") ||
    anyDirHas(".ts") ||
    anyDirHas(".tsx");

  // JavaScript
  const hasJavaScript =
    anyDirHas(".js") ||
    anyDirHas(".jsx") ||
    anyDirHas(".mjs") ||
    (anyDirHasFile("package.json") && !hasTypeScript);

  if (hasTypeScript) { languages.add("TypeScript"); }
  if (hasJavaScript) { languages.add("JavaScript"); }

  // Python
  if (
    anyDirHasFile("requirements.txt") ||
    anyDirHasFile("pyproject.toml") ||
    anyDirHasFile("setup.py") ||
    anyDirHas(".py")
  ) {
    languages.add("Python");
  }

  // Go
  if (anyDirHasFile("go.mod") || anyDirHas(".go")) {
    languages.add("Go");
  }

  // Rust
  if (anyDirHasFile("Cargo.toml") || anyDirHas(".rs")) {
    languages.add("Rust");
  }

  // Java
  if (
    anyDirHasFile("pom.xml") ||
    anyDirHasFile("build.gradle") ||
    anyDirHas(".java")
  ) {
    languages.add("Java");
  }

  // C#
  if (anyDirHas(".csproj") || anyDirHas(".sln") || anyDirHas(".cs")) {
    languages.add("C#");
  }

  // C++
  if (
    anyDirHasFile("CMakeLists.txt") ||
    anyDirHas(".cpp") ||
    anyDirHas(".cc") ||
    anyDirHas(".cxx")
  ) {
    languages.add("C++");
  }

  return Array.from(languages);
}

/**
 * Detect frameworks by parsing package.json dependencies in root and child dirs.
 */
export function detectFrameworks(workspaceRoot: string): string[] {
  const frameworks = new Set<string>();

  const frameworkMap: Record<string, string> = {
    react: "React",
    next: "Next.js",
    vue: "Vue",
    "@angular/core": "Angular",
    express: "Express",
    fastify: "Fastify",
    koa: "Koa",
    "nest.js": "NestJS",
    "@nestjs/core": "NestJS",
    svelte: "Svelte",
    solid: "Solid",
    "aws-cdk-lib": "AWS CDK",
    django: "Django",
    flask: "Flask",
    fastapi: "FastAPI",
  };

  // Scan package.json in root and immediate child directories
  const dirs = getSearchDirs(workspaceRoot);
  for (const dir of dirs) {
    const packageJson = path.join(dir, "package.json");
    if (!fs.existsSync(packageJson)) { continue; }
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJson, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [dep, framework] of Object.entries(frameworkMap)) {
        if (allDeps[dep]) { frameworks.add(framework); }
      }
    } catch { /* ignore */ }
  }

  // Python frameworks — scan requirements.txt
  const requirementsTxt = path.join(workspaceRoot, "requirements.txt");
  if (fs.existsSync(requirementsTxt)) {
    try {
      const content = fs.readFileSync(requirementsTxt, "utf-8").toLowerCase();
      if (content.includes("django")) frameworks.add("Django");
      if (content.includes("flask")) frameworks.add("Flask");
      if (content.includes("fastapi")) frameworks.add("FastAPI");
    } catch {
      // ignore
    }
  }

  return Array.from(frameworks);
}

/**
 * Detect default branch from git — prefers the current branch the user is on,
 * since that's what they're actively working with.
 */
export function detectDefaultBranch(workspaceRoot: string): string {
  const gitOpts = { cwd: workspaceRoot, encoding: "utf-8" as const, stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"] };

  // 1. Current branch — what the user is actively on
  try {
    const current = execSync("git branch --show-current", gitOpts).trim();
    if (current) return current;
  } catch { /* ignore */ }

  // 2. Remote HEAD (default branch of the remote)
  try {
    const result = execSync("git symbolic-ref refs/remotes/origin/HEAD", gitOpts).trim();
    const parts = result.split("/");
    const branch = parts[parts.length - 1];
    if (branch) return branch;
  } catch { /* ignore */ }

  // 3. Check if repo has 'main' or 'master'
  try {
    const branches = execSync("git branch", gitOpts);
    if (branches.includes("main")) return "main";
    if (branches.includes("master")) return "master";
  } catch { /* ignore */ }

  return "main";
}

/**
 * Detect project description from README.md.
 * Returns the first non-title paragraph (up to 200 chars).
 */
export function detectDescription(workspaceRoot: string): string | null {
  const readme = path.join(workspaceRoot, "README.md");
  if (!fs.existsSync(readme)) return null;

  try {
    const content = fs.readFileSync(readme, "utf-8");
    const lines = content.split("\n");

    let inCodeBlock = false;
    let foundTitle = false;

    for (const line of lines) {
      // Track code blocks
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      // Skip title lines (# Title)
      if (line.trim().match(/^#+\s+/)) {
        foundTitle = true;
        continue;
      }

      // Skip empty lines
      if (!line.trim()) continue;

      // First non-empty, non-title line after title — use it
      if (foundTitle) {
        const desc = line.trim();
        return desc.length > 200 ? desc.slice(0, 200) + "..." : desc;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Run all detection steps and return metadata.
 */
export function detectAll(workspaceRoot: string): DetectedMetadata {
  return {
    name: detectProjectName(workspaceRoot),
    description: detectDescription(workspaceRoot),
    languages: detectLanguages(workspaceRoot),
    frameworks: detectFrameworks(workspaceRoot),
    defaultBranch: detectDefaultBranch(workspaceRoot),
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Sanitize project name to alphanumeric + hyphens/underscores.
 */
function sanitizeName(name: string): string {
  // Remove npm scope prefix like @org/package → package
  let cleaned = name.replace(/^@[^/]+\//, "");
  // Replace invalid chars with hyphens
  cleaned = cleaned.replace(/[^a-zA-Z0-9-_]/g, "-");
  // Remove leading/trailing hyphens
  cleaned = cleaned.replace(/^-+|-+$/g, "");
  return cleaned || "my-project";
}

/**
 * Return directories to scan: workspace root, root/src/, and every immediate
 * child directory (+ its src/ subfolder). Covers monorepos like:
 *   root/frontend/src/App.jsx
 *   root/backend/index.js
 */
function getSearchDirs(workspaceRoot: string): string[] {
  const dirs = [workspaceRoot, path.join(workspaceRoot, "src")];
  try {
    for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        const child = path.join(workspaceRoot, entry.name);
        dirs.push(child);
        dirs.push(path.join(child, "src"));
      }
    }
  } catch { /* ignore */ }
  return dirs;
}

/**
 * Check if a directory contains files with a specific extension (shallow scan).
 */
function hasFilesWithExtension(dir: string, ext: string): boolean {
  try {
    if (!fs.existsSync(dir)) { return false; }
    const files = fs.readdirSync(dir);
    return files.some((file) => file.endsWith(ext));
  } catch {
    return false;
  }
}
