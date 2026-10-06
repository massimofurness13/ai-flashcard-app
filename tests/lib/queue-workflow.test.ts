import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Exercise the actual inline Bash, with curl replaced before execution.
// This never calls the production worker or spends image credits.
const workflow = readFileSync(new URL("../../.github/workflows/process-image-queue.yml", import.meta.url), "utf8");
const script = workflow.split("        run: |\n")[1].split("\n").map(line => line.replace(/^          /, "")).join("\n");
function run(curlBody: string, secrets = true) {
  return spawnSync("bash", ["-e", "-c", `curl() { ${curlBody}; }\n${script}`], {
    encoding: "utf8", timeout: 5000,
    env: { PATH: process.env.PATH, APP_URL: secrets ? "https://fixture.invalid" : "", CRON_SECRET: secrets ? "test-fixture" : "" },
  });
}
describe("background worker health reporting", () => {
  it("fails visibly when all HTTP calls fail", () => {
    const result = run("return 22");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("All queue-drain requests failed");
  });
  it("stops successfully when the queue is empty", () => {
    const result = run(`printf '%s' '{"reason":"no_work"}'`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Queue drained, stopping.");
    expect(result.stdout).not.toContain("Attempt 2:");
  });
  it("completes all successful drain calls when work remains", () => {
    const result = run(`printf '%s' '{"processed":40,"remaining":200}'`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Attempt 5:");
  });
  it("refuses to run without its dedicated secrets", () => {
    expect(run("return 0", false).status).toBe(1);
  });
});
