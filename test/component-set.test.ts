import {
  ComponentSet,
  ComponentSetBuilder,
} from "@salesforce/source-deploy-retrieve";
import { expect } from "chai";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { upsertInOrg, writeComponentSetToDisk } from "../src/component-set.js";
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
      expect(files).to.deep.equal([
        {
          fullName: "Dummy__c-en_US",
          type: "CustomObjectTranslation",
          filePath: join(
            "./tmp",
            "main",
            "default",
            "objectTranslations",
            "Dummy__c-en_US",
            "Dummy__c-en_US.objectTranslation-meta.xml"
          ),
        },
        {
          fullName: "Dummy__c-en_US.Type__c",
          type: "CustomFieldTranslation",
          filePath: join(
            "./tmp",
            "main",
            "default",
            "objectTranslations",
            "Dummy__c-en_US",
            "Type__c.fieldTranslation-meta.xml"
          ),
        },
      ]);
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
  describe("upsertInOrg", () => {
    afterEach(() => {
      rmSync("./tmp", { recursive: true, force: true });
    });
    it("composes CustomFieldTranslation children into their parent CustomObjectTranslation", async () => {
      const decomposed = new ComponentSet();
      decomposed.add(
        await createSourceComponentWithMetadata(
          customObjectTranslationMetadataComponent,
          customObjectTranslation
        )
      );
      await writeComponentSetToDisk(decomposed, "./tmp");

      const componentSet = await ComponentSetBuilder.build({
        sourcepath: [join("./tmp", "main", "default", "objectTranslations")],
      });

      const upserted: unknown[] = [];
      const connection = {
        metadata: {
          upsert: async (_typeName: string, metadata: unknown[]) => {
            upserted.push(...metadata);
            return metadata.map((m: { fullName: string }) => ({
              fullName: m.fullName,
              success: true,
            }));
          },
        },
        // biome-ignore lint: minimal Connection stub for the test
      } as any;

      await upsertInOrg(componentSet, connection);

      expect(upserted).to.have.lengthOf(1);
      expect(upserted[0]).to.deep.include({ fullName: "Dummy__c-en_US" });
      expect((upserted[0] as { fields: unknown[] }).fields).to.have.lengthOf(1);
      expect(
        (upserted[0] as { fields: Array<{ name: string }> }).fields[0]
      ).to.deep.include({
        name: "Type__c",
      });
    });
  });
});
