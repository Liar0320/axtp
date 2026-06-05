#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(process.argv[2] ?? process.cwd());
const requireFromGenerators = createRequire(path.join(root, "generators", "package.json"));
const YAML = requireFromGenerators("yaml");

const conformanceDir = path.join(root, "conformance");
const manifestPath = path.join(conformanceDir, "manifest.yaml");
const caseSchemaPath = path.join(conformanceDir, "schemas", "conformance-case.schema.json");
const resultSchemaPath = path.join(conformanceDir, "schemas", "conformance-result.schema.json");

const errors = [];
const profileCounts = new Map();

function fail(message) {
  errors.push(message);
}

function readYaml(file) {
  return YAML.parse(fs.readFileSync(file, "utf8"));
}

function walkYaml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkYaml(full));
    } else if (entry.isFile() && entry.name.endsWith(".yaml")) {
      out.push(full);
    }
  }
  return out.sort();
}

function expectObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
    return false;
  }
  return true;
}

function expectString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string`);
    return false;
  }
  return true;
}

function expectArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${label} must be a non-empty array`);
    return false;
  }
  return true;
}

function caseIdFromPath(file) {
  const relative = path.relative(path.join(conformanceDir, "cases"), file);
  return relative.replace(/\.yaml$/, "").split(path.sep).join(".");
}

function validateCase(file, value) {
  const label = path.relative(root, file);
  if (!expectObject(value, label)) return;

  const required = ["id", "title", "since", "level", "profiles", "steps", "assertions"];
  for (const key of required) {
    if (!(key in value)) fail(`${label} missing required field: ${key}`);
  }

  expectString(value.id, `${label}.id`);
  expectString(value.title, `${label}.title`);
  expectString(value.since, `${label}.since`);
  expectString(value.level, `${label}.level`);
  expectArray(value.profiles, `${label}.profiles`);
  expectArray(value.steps, `${label}.steps`);
  expectArray(value.assertions, `${label}.assertions`);

  const expectedId = caseIdFromPath(file);
  if (value.id !== expectedId) {
    fail(`${label} id ${value.id} does not match path id ${expectedId}`);
  }

  if (Array.isArray(value.profiles)) {
    for (const profile of value.profiles) {
      if (typeof profile === "string") {
        profileCounts.set(profile, (profileCounts.get(profile) ?? 0) + 1);
      }
    }
  }
}

if (!fs.existsSync(manifestPath)) fail(`Missing ${path.relative(root, manifestPath)}`);
if (!fs.existsSync(caseSchemaPath)) fail(`Missing ${path.relative(root, caseSchemaPath)}`);
if (!fs.existsSync(resultSchemaPath)) fail(`Missing ${path.relative(root, resultSchemaPath)}`);

JSON.parse(fs.readFileSync(caseSchemaPath, "utf8"));
JSON.parse(fs.readFileSync(resultSchemaPath, "utf8"));

const manifest = readYaml(manifestPath);
expectObject(manifest, "manifest");
expectObject(manifest.conformance, "manifest.conformance");
expectObject(manifest.levels, "manifest.levels");
expectString(manifest.conformance?.version, "manifest.conformance.version");
expectString(manifest.conformance?.spec_min, "manifest.conformance.spec_min");

const caseFiles = walkYaml(path.join(conformanceDir, "cases"));
const casesById = new Map();
for (const file of caseFiles) {
  const value = readYaml(file);
  validateCase(file, value);
  if (typeof value?.id === "string") {
    if (casesById.has(value.id)) fail(`Duplicate case id: ${value.id}`);
    casesById.set(value.id, { file, value });
  }
}

for (const [level, value] of Object.entries(manifest.levels ?? {})) {
  if (!expectObject(value, `manifest.levels.${level}`)) continue;
  const requiredCases = value.required_cases;
  if (!Array.isArray(requiredCases)) {
    fail(`manifest.levels.${level}.required_cases must be an array`);
    continue;
  }
  for (const id of requiredCases) {
    if (!casesById.has(id)) {
      fail(`manifest level ${level} references missing case: ${id}`);
    }
  }
}

for (const file of walkYaml(path.join(conformanceDir, "profiles"))) {
  const value = readYaml(file);
  const label = path.relative(root, file);
  expectObject(value, label);
  expectString(value?.id, `${label}.id`);
  expectString(value?.since, `${label}.since`);
}

if (errors.length > 0) {
  console.error("[FAIL] conformance validation failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`[OK] conformance manifest: ${manifest.conformance.version} (${manifest.conformance.spec_min})`);
console.log(`[OK] conformance cases: ${casesById.size}`);
for (const [profile, count] of [...profileCounts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`[OK] profile coverage: ${profile}=${count}`);
}
