import { expect } from "chai";
import {
  cloneSourceComponent,
  createSourceComponentWithMetadata,
} from "../src/source-component.js";
import {
  customField,
  customFieldMetadataComponent,
  customObject,
  customObjectMetadataComponent,
} from "./fixtures/sourcecomponents.js";

describe("SourceComponent", () => {
  describe("createSourceComponentWithMetadata", () => {
    it("CustomObject", async () => {
      const sourceComponent = await createSourceComponentWithMetadata(
        customObjectMetadataComponent,
        customObject
      );
      expect(sourceComponent).to.have.property("fullName", "Account");
      expect(sourceComponent.type).to.have.property("name", "CustomObject");
      expect(sourceComponent).to.have.property(
        "xml",
        "objects/Account/Account.object-meta.xml"
      );
    });

    it("CustomField", async () => {
      const sourceComponent = await createSourceComponentWithMetadata(
        customFieldMetadataComponent,
        customField
      );
      expect(sourceComponent).to.have.property("fullName", "Account.Industry");
      expect(sourceComponent.type).to.have.property("name", "CustomField");
      expect(sourceComponent).to.have.property(
        "xml",
        "objects/Account/fields/Industry.field-meta.xml"
      );
      expect(sourceComponent).to.have.property("parent");
      expect(sourceComponent.parent).to.have.property("fullName", "Account");
      // fake source components don't have xml and tree
      expect(sourceComponent.parent).to.have.property("xml", undefined);
    });
  });

  describe("cloneSourceComponent", () => {
    it("removes -meta.xml", async () => {
      const sourceComponent = await createSourceComponentWithMetadata(
        customFieldMetadataComponent,
        customField
      );
      const adjustedSourceComponent = await cloneSourceComponent(
        sourceComponent,
        (filePath) => filePath.replace("-meta.xml", "")
      );
      expect(adjustedSourceComponent).to.have.property(
        "xml",
        "objects/Account/fields/Industry.field"
      );
      expect(adjustedSourceComponent.parent).to.have.property("xml", undefined);
    });
  });
});
