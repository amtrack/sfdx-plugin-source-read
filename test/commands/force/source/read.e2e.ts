import { run } from "../../../e2e";
import { expect } from "chai";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("E2E:force source read", () => {
  it("reads the Admin Profile", async () => {
    const result = await run(`force source read -m Profile:Admin`);
    expect(result.stdout).to.contain("reading Profile:Admin");
    const profile = await readFile(join("force-app", "main", "default", "profiles", "Admin.profile-meta.xml"), "utf8");
    const lines = profile.split("\n");
    expect(lines[0]).to.equal(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(lines[1]).to.equal(`<Profile xmlns="http://soap.sforce.com/2006/04/metadata">`);
    expect(lines[2]).to.equal(`    <applicationVisibilities>`);
    expect(lines.length).to.be.greaterThan(100);
  });
});
