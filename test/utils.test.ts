import { expect } from "chai";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { convertToXml, parseCommaSeparatedValues } from "../src/utils";

describe("utils", () => {
  describe("parseCommaSeparatedValues", () => {
    it("should parse", () => {
      expect(parseCommaSeparatedValues("foo-bar,baz,bazn")).to.deep.equal(["foo-bar", "baz", "bazn"]);
    });
  });
  describe("convertToXml", () => {
    it("should convert a Profile", () => {
      const component = {
        fullName: "Admin",
        type: {
          name: "Profile",
        },
      };
      const data = {
        custom: false,
        userLicense: "Salesforce",
        userPermissions: [
          {
            enabled: true,
            name: "ViewSetup",
          },
        ],
      };
      const mdXml = readFileSync(join("test", "fixtures", "Admin.profile-meta.xml"), "utf8");
      expect(convertToXml(component, data)).to.deep.equal(mdXml);
    });
  });
});
