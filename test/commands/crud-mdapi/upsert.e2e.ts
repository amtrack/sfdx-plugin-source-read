import { expect } from "chai";
import { execa } from "execa";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { run, runJson } from "../../e2e.js";

const DEFAULT_PACKAGE_DIR = join("force-app", "main", "default");

type UpsertResult = {
  success: boolean;
  files: Array<{ fullName: string; type: string; filePath: string }>;
};

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
      const profilePath = join(
        "sfdx-source",
        "profile-with-field-permissions",
        "profiles",
        "Dummy.profile-meta.xml"
      );
      const result = await runJson<UpsertResult>(
        `crud-mdapi upsert --source-dir ${profilePath}`
      );
      expect(result.success).to.equal(true);
      expect(result.files).to.deep.equal([
        {
          fullName: "Dummy",
          type: "Profile",
          filePath: profilePath,
        },
      ]);
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
  describe("CustomObjectTranslation with CustomFieldTranslation", () => {
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
        join(
          "sfdx-source",
          "customobjecttranslations-with-fieldtranslations",
          "objects"
        ),
      ]);
    });
    it("upsert the CustomObjectTranslation with CustomFieldTranslation and returns the parent and child files", async () => {
      const result = await runJson<UpsertResult>(
        `crud-mdapi upsert --source-dir ${sourceDir}`
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
    });
    it("read the CustomObjectTranslation with CustomFieldTranslation", async () => {
      await run(
        `crud-mdapi read --metadata CustomObjectTranslation:Dummy__c-en_US`
      );
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
          force: true,
        }
      );
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--no-prompt",
        "--metadata",
        "CustomObject:Dummy__c",
      ]);
    });
  });
  describe("RecordTypes with Picklist values", () => {
    before("deploy", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "deploy",
        "start",
        "--source-dir",
        join(
          "sfdx-source",
          "recordtypes-with-picklistvalues",
          "objects",
          "DummyWithRT__c",
          "DummyWithRT__c.object-meta.xml"
        ),
        "--source-dir",
        join(
          "sfdx-source",
          "recordtypes-with-picklistvalues",
          "objects",
          "DummyWithRT__c",
          "fields"
        ),
      ]);
    });
    it("upsert RecordTypes with Picklist values", async () => {
      const recordTypesDir = join(
        "sfdx-source",
        "recordtypes-with-picklistvalues",
        "objects",
        "DummyWithRT__c",
        "recordTypes"
      );
      const result = await runJson<UpsertResult>(
        `crud-mdapi upsert --source-dir ${recordTypesDir}`
      );
      expect(result.success).to.equal(true);
      expect(result.files).to.deep.include({
        fullName: "DummyWithRT__c.DummyRecordType",
        type: "RecordType",
        filePath: join(recordTypesDir, "DummyRecordType.recordType-meta.xml"),
      });
      expect(result.files).to.deep.include({
        fullName: "DummyWithRT__c.DummyRecordType2",
        type: "RecordType",
        filePath: join(recordTypesDir, "DummyRecordType2.recordType-meta.xml"),
      });
      expect(result.files).to.have.lengthOf(2);
    });
    it("read RecordTypes with Picklist values", async () => {
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
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      rmSync(
        join(DEFAULT_PACKAGE_DIR, "objects", "DummyWithRT__c", "recordTypes"),
        { recursive: true, force: true }
      );
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--no-prompt",
        "--metadata",
        "CustomObject:DummyWithRT__c",
      ]);
    });
  });
  describe("Translations with CustomLabels", () => {
    before("deploy", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "deploy",
        "start",
        "--source-dir",
        join("sfdx-source", "translations-with-labels", "labels"),
      ]);
    });
    it("upsert Translations with CustomLabels", async () => {
      const translationPath = join(
        "sfdx-source",
        "translations-with-labels",
        "translations",
        "en_US.translation-meta.xml"
      );
      const result = await runJson<UpsertResult>(
        `crud-mdapi upsert --source-dir ${translationPath}`
      );
      expect(result.success).to.equal(true);
      expect(result.files).to.deep.equal([
        {
          fullName: "en_US",
          type: "Translations",
          filePath: translationPath,
        },
      ]);
    });
    it("read Translations with CustomLabels", async () => {
      await run(`crud-mdapi read --metadata Translations:en_US`);
      expect(
        readFileSync(
          join(
            DEFAULT_PACKAGE_DIR,
            "translations",
            "en_US.translation-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`        <label>Hello</label>`);
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      rmSync(join(DEFAULT_PACKAGE_DIR, "translations"), {
        recursive: true,
        force: true,
      });
      await execa("sf", [
        "project",
        "delete",
        "source",
        "--no-prompt",
        "--metadata",
        "CustomLabel:Greeting",
      ]);
    });
  });
});
