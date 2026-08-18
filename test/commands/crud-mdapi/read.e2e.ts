import { expect } from "chai";
import { execa } from "execa";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { run, runJson } from "../../e2e.js";

const DEFAULT_PACKAGE_DIR = join("force-app", "main", "default");

type ReadResult = {
  success: boolean;
  files: Array<{ fullName: string; type: string; filePath: string }>;
};

describe("crud-mdapi read", () => {
  describe("flags-dir", async () => {
    afterEach("delete", async function () {
      rmSync(DEFAULT_PACKAGE_DIR, {
        recursive: true,
        force: true,
      });
    });
    it("reads a CustomField without flags-dir", async () => {
      await run(`crud-mdapi read --metadata CustomField:Account.Name`);
      expect(
        readFileSync(
          join(
            DEFAULT_PACKAGE_DIR,
            "objects",
            "Account",
            "fields",
            "Name.field-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`    <fullName>Name</fullName>`);
    });
    it.skip("reads a CustomField with flags-dir", async () => {
      await run(`crud-mdapi read --flags-dir test/fixtures/myflags`);
      expect(
        readFileSync(
          join(
            DEFAULT_PACKAGE_DIR,
            "objects",
            "Account",
            "fields",
            "Name.field-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`    <fullName>Name</fullName>`);
    });
  });

  describe("--metadata (default package dir)", async () => {
    before("deploy", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "deploy",
        "start",
        "--source-dir",
        join("sfdx-source", "customobjecttranslations-with-fieldtranslations"),
      ]);
    });
    it("reads CustomObjectTranslations with FieldTranslations and returns the parent and child files", async () => {
      const result = await runJson<ReadResult>(
        `crud-mdapi read --metadata CustomObjectTranslation:Dummy__c-en_US`
      );
      expect(result.success).to.equal(true);
      expect(result.files).to.deep.include({
        fullName: "Dummy__c-en_US",
        type: "CustomObjectTranslation",
        filePath: join(
          DEFAULT_PACKAGE_DIR,
          "objectTranslations",
          "Dummy__c-en_US",
          "Dummy__c-en_US.objectTranslation-meta.xml"
        ),
      });
      expect(result.files).to.deep.include({
        fullName: "Dummy__c-en_US.Type__c",
        type: "CustomFieldTranslation",
        filePath: join(
          DEFAULT_PACKAGE_DIR,
          "objectTranslations",
          "Dummy__c-en_US",
          "Type__c.fieldTranslation-meta.xml"
        ),
      });
      expect(result.files).to.have.lengthOf(2);
      expect(
        readFileSync(
          join(
            DEFAULT_PACKAGE_DIR,
            "objectTranslations",
            "Dummy__c-en_US",
            "Type__c.fieldTranslation-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`    <help>TEST help text</help>`);
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      rmSync(
        join(DEFAULT_PACKAGE_DIR, "objectTranslations", "Dummy__c-en_US"),
        {
          recursive: true,
        }
      );
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--json",
        "--no-prompt",
        "--metadata",
        "CustomObject:Dummy__c",
      ]);
    });
  });

  describe("--source-dir (written back to --source-dir)", async () => {
    const sourceDir = join(
      "sfdx-source",
      "customobjecttranslations-with-fieldtranslations",
      "objectTranslations"
    );
    before("deploy", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "deploy",
        "start",
        "--source-dir",
        join("sfdx-source", "customobjecttranslations-with-fieldtranslations"),
      ]);
    });
    it("reads CustomObjectTranslations with FieldTranslations back into --source-dir", async () => {
      const result = await runJson<ReadResult>(
        `crud-mdapi read --source-dir ${sourceDir}`
      );
      expect(result.success).to.equal(true);
      expect(result.files).to.deep.include({
        fullName: "Dummy__c-en_US",
        type: "CustomObjectTranslation",
        filePath: join(
          sourceDir,
          "Dummy__c-en_US",
          "Dummy__c-en_US.objectTranslation-meta.xml"
        ),
      });
      expect(result.files).to.deep.include({
        fullName: "Dummy__c-en_US.Type__c",
        type: "CustomFieldTranslation",
        filePath: join(
          sourceDir,
          "Dummy__c-en_US",
          "Type__c.fieldTranslation-meta.xml"
        ),
      });
      expect(result.files).to.have.lengthOf(2);
      // nothing should have been written to the default package dir
      expect(
        readFileSync(
          join(
            sourceDir,
            "Dummy__c-en_US",
            "Type__c.fieldTranslation-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`    <help>TEST help text</help>`);
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--json",
        "--no-prompt",
        "--metadata",
        "CustomObject:Dummy__c",
      ]);
    });
  });

  describe("Profile with field permissions", () => {
    before("deploy", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "deploy",
        "start",
        "--source-dir",
        join("sfdx-source", "profile-with-field-permissions"),
      ]);
    });
    it("reads a Profile with field permissions", async () => {
      await run(`crud-mdapi read --metadata Profile:Dummy`);
      const lines = readFileSync(
        join(DEFAULT_PACKAGE_DIR, "profiles", "Dummy.profile-meta.xml"),
        "utf8"
      ).split("\n");
      expect(lines[0]).to.equal(`<?xml version="1.0" encoding="UTF-8"?>`);
      expect(lines[1]).to.match(/<Profile/);
      expect(lines).to.contain(`        <field>Account.IsTest__c</field>`);
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--json",
        "--no-prompt",
        "--metadata",
        "CustomField:Account.IsTest__c",
        "--metadata",
        "Profile:Dummy",
      ]);
    });
  });

  describe("RecordTypes with Picklist values", async () => {
    before("deploy", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "deploy",
        "start",
        "--source-dir",
        join("sfdx-source", "recordtypes-with-picklistvalues"),
      ]);
    });
    it("reads RecordTypes with Picklist values", async () => {
      await run(
        `crud-mdapi read --metadata RecordType:DummyWithRT__c.DummyRecordType --metadata RecordType:DummyWithRT__c.DummyRecordType2`
      );
      expect(
        readFileSync(
          join(
            DEFAULT_PACKAGE_DIR,
            "objects",
            "DummyWithRT__c",
            "recordTypes",
            "DummyRecordType.recordType-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`        <picklist>Type__c</picklist>`);
      expect(
        readFileSync(
          join(
            DEFAULT_PACKAGE_DIR,
            "objects",
            "DummyWithRT__c",
            "recordTypes",
            "DummyRecordType2.recordType-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`        <picklist>Type__c</picklist>`);
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      rmSync(
        join(DEFAULT_PACKAGE_DIR, "objects", "DummyWithRT__c", "recordTypes"),
        { recursive: true }
      );
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--json",
        "--no-prompt",
        "--metadata",
        "CustomObject:DummyWithRT__c",
      ]);
    });
  });

  describe("--metadata --output-dir", async () => {
    before("deploy", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "deploy",
        "start",
        "--source-dir",
        join("sfdx-source", "translations-with-labels"),
      ]);
    });
    it("reads Translations with CustomLabels into --output-dir", async () => {
      const result = await runJson<ReadResult>(
        `crud-mdapi read --metadata Translations:en_US --output-dir tmp`
      );
      expect(result.success).to.equal(true);
      expect(result.files).to.deep.include({
        fullName: "en_US",
        type: "Translations",
        filePath: join(
          "tmp",
          "main",
          "default",
          "translations",
          "en_US.translation-meta.xml"
        ),
      });
      expect(result.files).to.have.lengthOf(1);
      expect(
        readFileSync(
          join(
            "tmp",
            "main",
            "default",
            "translations",
            "en_US.translation-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`        <label>Hello</label>`);
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--json",
        "--no-prompt",
        "--metadata",
        "CustomLabel:Greeting",
      ]);
      rmSync("tmp", {
        recursive: true,
      });
    });
  });
});
