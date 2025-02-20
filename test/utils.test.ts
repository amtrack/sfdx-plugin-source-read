import { expect } from "chai";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chunk,
  convertToXml,
  groupBy,
  parseCommaSeparatedValues,
} from "../src/utils.js";

describe("utils", () => {
  describe("parseCommaSeparatedValues", () => {
    it("should parse", () => {
      expect(parseCommaSeparatedValues("foo-bar,baz,bazn")).to.deep.equal([
        "foo-bar",
        "baz",
        "bazn",
      ]);
    });
    it("should parse an empty string", () => {
      expect(parseCommaSeparatedValues("")).to.deep.equal([]);
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
      const mdXml = readFileSync(
        join("test", "fixtures", "Admin.profile-meta.xml"),
        "utf8"
      );
      expect(convertToXml(component, data)).to.deep.equal(mdXml);
    });
    it("should convert a CustomField", () => {
      const component = {
        fullName: "Account.Industry",
        type: {
          name: "CustomField",
        },
        parentType: {
          name: "CustomObject",
        },
      };
      const data = {
        fullName: "Account.Industry",
        trackFeedHistory: false,
        type: "Picklist",
      };
      const mdXml = readFileSync(
        join("test", "fixtures", "Industry.field-meta.xml"),
        "utf8"
      );
      expect(convertToXml(component, data)).to.deep.equal(mdXml);
    });
  });
  describe("chunk", () => {
    it("should split an array into chunks of 2", () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).to.deep.equal([[1, 2], [3, 4], [5]]);
    });
  });
  describe("groupBy", () => {
    it("should group an array by odd/even", () => {
      expect(
        groupBy([1, 2, 3, 4, 5], (item) => (item % 2 === 0 ? "even" : "odd"))
      ).to.deep.equal({ even: [2, 4], odd: [1, 3, 5] });
    });
  });
});
