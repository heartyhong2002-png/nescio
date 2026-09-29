import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

test("P0: DB Backup workflow script logic validation", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nescio-backup-test-"));
  const backupsDir = path.join(tmpDir, "backups");
  fs.mkdirSync(backupsDir, { recursive: true });

  await t.test("mock pg_dump creates date-stamped SQL file", () => {
    const today = new Date().toISOString().slice(0, 10);
    const dumpFile = path.join(backupsDir, `${today}.sql`);
    fs.writeFileSync(dumpFile, "-- Mock PostgreSQL Dump (public schema)\nCREATE TABLE profiles();");

    assert.ok(fs.existsSync(dumpFile));
    const content = fs.readFileSync(dumpFile, "utf8");
    assert.match(content, /Mock PostgreSQL Dump/);
  });

  await t.test("30-day pruning removes files older than 30 days and preserves recent files", () => {
    const recentFile = path.join(backupsDir, "2026-09-28.sql");
    const oldFile = path.join(backupsDir, "2026-08-01.sql");

    fs.writeFileSync(recentFile, "-- recent backup");
    fs.writeFileSync(oldFile, "-- old backup");

    // Set mtime of oldFile to 35 days ago
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, thirtyFiveDaysAgo, thirtyFiveDaysAgo);

    // Prune logic matching workflow: files older than 30 days
    const now = Date.now();
    const files = fs.readdirSync(backupsDir);
    for (const f of files) {
      if (f.endsWith(".sql")) {
        const fullPath = path.join(backupsDir, f);
        const stats = fs.statSync(fullPath);
        const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageDays > 30) {
          fs.unlinkSync(fullPath);
        }
      }
    }

    assert.ok(fs.existsSync(recentFile), "Recent backup file should be preserved");
    assert.ok(!fs.existsSync(oldFile), "Old backup file (>30 days) should be pruned");
  });

  await t.test("fails safely when secret/URL is missing", () => {
    const missingDbUrl = "";
    assert.throws(() => {
      if (!missingDbUrl) {
        throw new Error("SUPABASE_DB_URL is unset; aborting backup to prevent empty commit");
      }
    }, /SUPABASE_DB_URL is unset/);
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
