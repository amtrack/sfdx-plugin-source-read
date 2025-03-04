import { expect } from "chai";
import { execa } from "execa";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { run } from "../../e2e.js";

const DEFAULT_PACKAGE_DIR = join("force-app", "main", "default");

describe("crud-mdapi read", () => {
  describe("CustomObjectTranslations with FieldTranslations", async () => {
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
    it("reads CustomObjectTranslations with FieldTranslations", async () => {
      await run(
        `crud-mdapi read --metadata CustomObjectTranslation:Dummy__c-en_US`
      );
      const lines = readFileSync(
        join(
          DEFAULT_PACKAGE_DIR,
          "objectTranslations",
          "Dummy__c-en_US",
          "Type__c.fieldTranslation-meta.xml"
        ),
        "utf8"
      ).split("\n");
      expect(lines).to.contain(`    <help>TEST help text</help>`);
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
      const lines = readFileSync(
        join(
          DEFAULT_PACKAGE_DIR,
          "objects",
          "DummyWithRT__c",
          "recordTypes",
          "DummyRecordType.recordType-meta.xml"
        ),
        "utf8"
      ).split("\n");
      expect(lines).to.contain(`        <picklist>Type__c</picklist>`);
      const lines2 = readFileSync(
        join(
          DEFAULT_PACKAGE_DIR,
          "objects",
          "DummyWithRT__c",
          "recordTypes",
          "DummyRecordType2.recordType-meta.xml"
        ),
        "utf8"
      ).split("\n");
      expect(lines2).to.contain(`        <picklist>Type__c</picklist>`);
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
        "--no-prompt",
        "--metadata",
        "CustomObject:DummyWithRT__c",
      ]);
    });
  });

  describe("Translations with CustomLabels with --output-dir", async () => {
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
    it("reads Translations with CustomLabels", async () => {
      await run(
        `crud-mdapi read --metadata Translations:en_US --output-dir tmp`
      );
      const lines = readFileSync(
        join(
          "tmp",
          "main",
          "default",
          "translations",
          "en_US.translation-meta.xml"
        ),
        "utf8"
      ).split("\n");
      expect(lines).to.contain(`        <label>Hello</label>`);
    });
    after("delete", async function () {
      this.timeout(300 * 1000);
      await execa("sf", [
        "project",
        "delete",
        "source",
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
