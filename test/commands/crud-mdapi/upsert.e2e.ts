import { expect } from "chai";
import { execa } from "execa";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { run } from "../../e2e.js";

const DEFAULT_PACKAGE_DIR = join("force-app", "main", "default");

describe("crud-mdapi upsert", () => {
  describe("Profile with field permissions", () => {
    before("deploy", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "deploy",
        "start",
        "--source-dir",
        join("sfdx-source", "profile-with-field-permissions", "objects"),
      ]);
    });
    it("upsert the Profile with field permissions", async () => {
      await run(
        `crud-mdapi upsert --source-dir ${join(
          "sfdx-source",
          "profile-with-field-permissions",
          "profiles",
          "Dummy.profile-meta.xml"
        )}`
      );
    });
    it("read the Profile with field permissions", async () => {
      await run(`crud-mdapi read --metadata Profile:Dummy`);
      const profile = readFileSync(
        join(DEFAULT_PACKAGE_DIR, "profiles", "Dummy.profile-meta.xml"),
        "utf8"
      );
      expect(profile).to.match(
        /<editable>true<\/editable>\s+<field>Account.IsTest__c<\/field>\s+<readable>true<\/readable>/
      );
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--no-prompt",
        "--metadata",
        "CustomField:Account.IsTest__c",
        "--metadata",
        "Profile:Dummy",
      ]);
    });
  });
});
