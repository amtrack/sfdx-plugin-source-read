import type {
  CustomField,
  CustomObject,
} from "@jsforce/jsforce-node/lib/api/metadata.js";
import {
  RegistryAccess,
  type MetadataComponent,
} from "@salesforce/source-deploy-retrieve";
import { expect } from "chai";
import { convertToSourceComponent } from "../src/index.js";

describe("lib", () => {
  describe("convertToSourceComponent", () => {
    it("should convert a CustomObject", async () => {
      const registry = new RegistryAccess();
      const metadataComponent: MetadataComponent = {
        fullName: "Account",
        type: registry.getTypeByName("CustomObject"),
      };
      const customObject: CustomObject = {
        fullName: "Account",
        actionOverrides: [],
        businessProcesses: [],
        compactLayouts: [],
        fieldSets: [],
        fields: [],
        indexes: [],
        listViews: [],
        profileSearchLayouts: [],
        recordTypes: [],
        sharingReasons: [],
        sharingRecalculations: [],
        validationRules: [],
        webLinks: [],
      };
      const sourceComponent = await convertToSourceComponent(
        metadataComponent,
        customObject
      );
      expect(sourceComponent).to.have.property("fullName", "Account");
      expect(sourceComponent.type).to.have.property("name", "CustomObject");
      expect(sourceComponent).to.have.property("xml", "objects/Account.object");
    });

    it("should convert a CustomField", async () => {
      const registry = new RegistryAccess();
      const metadataComponent: MetadataComponent = {
        fullName: "Account.Industry",
        type: registry.getTypeByName("CustomField"),
        parent: {
          fullName: "Account",
          type: registry.getTypeByName("CustomObject"),
        },
      };
      const customField: CustomField = {
        fullName: "Account.Industry",
        summaryFilterItems: [],
        trackFeedHistory: false,
        type: "Picklist",
      };
      const sourceComponent = await convertToSourceComponent(
        metadataComponent,
        customField
      );
      expect(sourceComponent).to.have.property("fullName", "Account");
      expect(sourceComponent.type).to.have.property("name", "CustomObject");
      expect(sourceComponent).to.have.property("xml", "objects/Account.object");
    });
  });
});
