import { expect } from "chai";
import { createSourceComponentWithMetadata } from "../src/source-component.js";
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
      // workaround: remove "-meta.xml" to make source-to-source conversion work
      expect(sourceComponent).to.have.property(
        "xml",
        "objects/Account/Account.object"
      );
    });

    it("CustomField", async () => {
      const sourceComponent = await createSourceComponentWithMetadata(
        customFieldMetadataComponent,
        customField
      );
      expect(sourceComponent).to.have.property("fullName", "Account.Industry");
      expect(sourceComponent.type).to.have.property("name", "CustomField");
      // workaround: remove "-meta.xml" to make source-to-source conversion work
      expect(sourceComponent).to.have.property(
        "xml",
        "objects/Account/fields/Industry.field"
      );
      expect(sourceComponent).to.have.property("parent");
      expect(sourceComponent.parent).to.have.property("fullName", "Account");
    });
  });
});
