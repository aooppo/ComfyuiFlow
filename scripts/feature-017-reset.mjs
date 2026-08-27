#!/usr/bin/env node
/* global process, URL */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const action = process.argv[2] ?? "";
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");

function fail(message) {
  process.stderr.write(`Feature 017 reset: ${message}\n`);
  process.exit(1);
}

async function dotenv() {
  const path = resolve(root, ".env");
  if (!existsSync(path)) fail("missing private .env");
  const values = {};
  for (const line of (await readFile(path, "utf8")).split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

async function listFiles(rootPath) {
  if (!existsSync(rootPath)) return [];
  const entries = await readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(rootPath, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}

async function manifest(rootPath) {
  const files = await listFiles(rootPath);
  const records = [];
  for (const path of files.sort()) {
    const bytes = await readFile(path);
    records.push({
      path: path.slice(root.length + 1),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return records;
}

function requireNoWorker() {
  const scan = spawnSync("/bin/ps", ["-Ao", "pid=,command="], { encoding: "utf8" });
  const lines = scan.stdout
    .split("\n")
    .filter((line) => /project-worker|project-dev|next-server/.test(line));
  if (lines.length) fail("related project process is active; stop it before reset");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
  if (result.status !== 0) {
    const detail = String(result.stderr ?? "")
      .replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[DATABASE_URL]")
      .trim();
    fail(
      `${command} failed${detail ? `: ${detail}` : " without printing private connection details"}`,
    );
  }
  return result.stdout;
}

async function backup() {
  requireNoWorker();
  const env = await dotenv();
  if (!env.DATABASE_URL) fail("DATABASE_URL is unavailable");
  const assets = resolve(root, env.PROJECT_ASSET_STORAGE_DIR ?? "var/project-assets");
  const generated = resolve(root, env.PROJECT_GENERATED_STORAGE_DIR ?? "var/project-generated");
  const offline = resolve(root, "offline-backups", `feature-017-${stamp}`);
  await mkdir(offline, { recursive: true });
  const dump = resolve(offline, "comfyuiflow.dump");
  const database = new URL(env.DATABASE_URL);
  const containers = run("docker", ["ps", "--format", "{{.ID}} {{.Ports}}"]);
  const container = containers
    .split("\n")
    .find((line) => line.includes("127.0.0.1:5448->"))
    ?.split(" ")[0];
  if (!container) fail("no PostgreSQL container is mapped to 127.0.0.1:5448");
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "pg_dump",
      "--format=custom",
      "--username",
      decodeURIComponent(database.username),
      "--dbname",
      database.pathname.slice(1),
    ],
    { encoding: null },
  );
  if (result.status !== 0 || !result.stdout?.length)
    fail("container PostgreSQL dump failed without printing private connection details");
  await writeFile(dump, result.stdout);
  const verify = spawnSync("docker", ["exec", "-i", container, "pg_restore", "--list"], {
    input: await readFile(dump),
    encoding: null,
  });
  if (verify.status !== 0)
    fail(
      "container PostgreSQL dump verification failed without printing private connection details",
    );
  const report = {
    createdAt: new Date().toISOString(),
    databaseDump: basename(dump),
    storage: [...(await manifest(assets)), ...(await manifest(generated))],
  };
  await writeFile(resolve(offline, "storage-sha256.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${offline}\n`);
}

async function verify() {
  requireNoWorker();
  const env = await dotenv();
  if (!env.DATABASE_URL) fail("DATABASE_URL is unavailable");
  const migrationRoot = resolve(root, "packages/project-core/prisma/migrations");
  const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (migrations.length !== 1 || migrations[0] !== "202608270001_capability_generation_mainline")
    fail("migration archaeology remains; reset requires only the Feature 017 baseline migration");
  const backupsRoot = resolve(root, "offline-backups");
  if (!existsSync(backupsRoot)) fail("no offline backup directory exists");
  const backups = (await readdir(backupsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(backupsRoot, entry.name));
  const backup = backups.find(
    (path) =>
      existsSync(resolve(path, "comfyuiflow.dump")) &&
      existsSync(resolve(path, "storage-sha256.json")),
  );
  if (!backup) fail("no verified database dump and storage manifest exists");
  const container = run("docker", ["ps", "--format", "{{.ID}} {{.Ports}}"])
    .split("\n")
    .find((line) => line.includes("127.0.0.1:5448->"))
    ?.split(" ")[0];
  if (!container) fail("no PostgreSQL container is mapped to 127.0.0.1:5448");
  const restore = spawnSync("docker", ["exec", "-i", container, "pg_restore", "--list"], {
    input: await readFile(resolve(backup, "comfyuiflow.dump")),
    encoding: null,
  });
  if (restore.status !== 0) fail("backup dump is not readable by PostgreSQL 16");
  const manifest = JSON.parse(await readFile(resolve(backup, "storage-sha256.json"), "utf8"));
  if (
    !Array.isArray(manifest.storage) ||
    !manifest.storage.every((item) => /^[a-f0-9]{64}$/.test(item.sha256))
  )
    fail("backup storage manifest is invalid");
  process.stdout.write(
    `${JSON.stringify({ readyForApprovedReset: true, migration: migrations[0], backup: basename(backup), files: manifest.storage.length })}\n`,
  );
}

async function inspectPostReset({ container, database, username, assets, generated }) {
  const expectedTables = [
    "_prisma_migrations",
    "Asset",
    "AiQaResult",
    "AiQaRun",
    "AuthorizationConsumption",
    "CapabilityProfile",
    "GenerationArtifact",
    "GenerationAssembly",
    "GenerationAttempt",
    "GenerationAttemptEvent",
    "GenerationAuthorization",
    "GenerationBatch",
    "GenerationImplementation",
    "GenerationPlan",
    "GenerationSpec",
    "GenerationTarget",
    "MaterializedGraphSnapshot",
    "OwnerDecision",
    "PlanningInputSnapshot",
    "Project",
    "ReferencePlan",
    "RetryPreview",
    "RuntimeContract",
    "ShotGenerationRequirement",
    "Storyboard",
    "StoryboardShot",
    "StoryboardVersion",
  ];
  const output = run("docker", [
    "exec",
    container,
    "psql",
    "--username",
    username,
    "--dbname",
    database,
    "-Atc",
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  ]);
  const tables = output.trim() ? output.trim().split("\n") : [];
  if (JSON.stringify(tables) !== JSON.stringify([...expectedTables].sort()))
    fail("post-reset public table set is not the Feature 017 canonical baseline");
  const activeFiles = [...(await listFiles(assets)), ...(await listFiles(generated))];
  if (activeFiles.length !== 0) fail("post-reset active storage is not empty");
  process.stdout.write(
    `${JSON.stringify({ canonicalTables: tables.length, activeStorageFiles: activeFiles.length })}\n`,
  );
}

async function reset() {
  if (process.env.FEATURE_017_RESET_APPROVED !== "1")
    fail("set FEATURE_017_RESET_APPROVED=1 after reviewing the backup");
  requireNoWorker();
  const env = await dotenv();
  if (!env.DATABASE_URL) fail("DATABASE_URL is unavailable");
  const prior = resolve(root, "offline-backups");
  if (!existsSync(prior)) fail("no offline backup directory exists");
  const database = new URL(env.DATABASE_URL);
  const containers = run("docker", ["ps", "--format", "{{.ID}} {{.Ports}}"]).split("\n");
  const container = containers.find((line) => line.includes("127.0.0.1:5448->"))?.split(" ")[0];
  if (!container) fail("no PostgreSQL container is mapped to 127.0.0.1:5448");
  const migrationRoot = resolve(root, "packages/project-core/prisma/migrations");
  const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (migrations.length !== 1 || migrations[0] !== "202608270001_capability_generation_mainline") {
    fail("migration archaeology remains; reset requires only the Feature 017 baseline migration");
  }
  const backups = (await readdir(prior, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(prior, entry.name));
  const validBackup = backups.find(
    (path) =>
      existsSync(resolve(path, "comfyuiflow.dump")) &&
      existsSync(resolve(path, "storage-sha256.json")),
  );
  if (!validBackup) fail("no verified database dump and storage manifest exists");
  const backupCheck = spawnSync("docker", ["exec", "-i", container, "pg_restore", "--list"], {
    input: await readFile(resolve(validBackup, "comfyuiflow.dump")),
    encoding: null,
  });
  if (backupCheck.status !== 0) fail("backup dump is not readable by PostgreSQL 16");
  const backupManifest = JSON.parse(
    await readFile(resolve(validBackup, "storage-sha256.json"), "utf8"),
  );
  if (
    !Array.isArray(backupManifest.storage) ||
    !backupManifest.storage.every((item) => /^[a-f0-9]{64}$/.test(item.sha256))
  )
    fail("backup storage manifest is invalid");
  const assets = resolve(root, env.PROJECT_ASSET_STORAGE_DIR ?? "var/project-assets");
  const generated = resolve(root, env.PROJECT_GENERATED_STORAGE_DIR ?? "var/project-generated");
  const offline = resolve(prior, `feature-017-storage-${stamp}`);
  await mkdir(offline, { recursive: true });
  for (const path of [assets, generated])
    if (existsSync(path)) await rename(path, resolve(offline, basename(path)));
  await mkdir(assets, { recursive: true });
  await mkdir(generated, { recursive: true });
  run("docker", [
    "exec",
    container,
    "psql",
    "--username",
    decodeURIComponent(database.username),
    "--dbname",
    database.pathname.slice(1),
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
  ]);
  run("pnpm", ["project:db:migrate"], { env: { ...process.env, DATABASE_URL: env.DATABASE_URL } });
  await inspectPostReset({
    container,
    database: database.pathname.slice(1),
    username: decodeURIComponent(database.username),
    assets,
    generated,
  });
  process.stdout.write(`${offline}\n`);
}

if (action === "backup") await backup();
else if (action === "verify") await verify();
else if (action === "reset") await reset();
else fail("usage: feature-017-reset.mjs backup|verify|reset");
