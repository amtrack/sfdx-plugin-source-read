import { ComponentSet } from "@salesforce/source-deploy-retrieve";
import { expect } from "chai";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { writeComponentSetToDisk } from "../src/component-set.js";
import { createSourceComponentWithMetadata } from "../src/source-component.js";
import {
  customField,
  customFieldMetadataComponent,
  customObjectTranslation,
  customObjectTranslationMetadataComponent,
  translations,
  translationsMetadataComponent,
} from "./fixtures/sourcecomponents.js";

describe("ComponentSet", () => {
  describe("writeComponentSetToDisk", () => {
    it("decomposes CustomObjectTranslation", async () => {
      const componentSet = new ComponentSet();
      componentSet.add(
        await createSourceComponentWithMetadata(
          customObjectTranslationMetadataComponent,
          customObjectTranslation
        )
      );
      const files = await writeComponentSetToDisk(componentSet, "./tmp");
      expect(files).to.have.length.greaterThanOrEqual(2);
      expect(
        readFileSync(
          join(
            "./tmp",
            "main",
            "default",
            "objectTranslations",
            "Dummy__c-en_US",
            "Dummy__c-en_US.objectTranslation-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`    <fullName>Dummy__c-en_US</fullName>`);
      expect(
        readFileSync(
          join(
            "./tmp",
            "main",
            "default",
            "objectTranslations",
            "Dummy__c-en_US",
            "Type__c.fieldTranslation-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`    <name>Type__c</name>`);
    });
    it("writes Translations", async () => {
      const componentSet = new ComponentSet();
      componentSet.add(
        await createSourceComponentWithMetadata(
          translationsMetadataComponent,
          translations
        )
      );
      const files = await writeComponentSetToDisk(componentSet, "./tmp");
      expect(files).to.have.lengthOf(1);
      expect(
        readFileSync(
          join(
            "./tmp",
            "main",
            "default",
            "translations",
            "en_US.translation-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`    <customLabels>`);
    });
    it("writes a CustomField", async () => {
      const componentSet = new ComponentSet();
      componentSet.add(
        await createSourceComponentWithMetadata(
          customFieldMetadataComponent,
          customField
        )
      );
      const files = await writeComponentSetToDisk(componentSet, "./tmp");
      expect(files).to.have.lengthOf(1);
      expect(
        readFileSync(
          join(
            "./tmp",
            "main",
            "default",
            "objects",
            "Account",
            "fields",
            "Industry.field-meta.xml"
          ),
          "utf8"
        ).split("\n")
      ).to.contain(`    <type>Picklist</type>`);
    });
    afterEach(() => {
      rmSync("./tmp", { recursive: true, force: true });
    });
  });
});
