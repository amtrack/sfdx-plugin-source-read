import { Builder } from "xml2js";

export function parseCommaSeparatedValues(
  commaSeparatedMetadataComponentNames
) {
  if (!commaSeparatedMetadataComponentNames) {
    return [];
  }
  return commaSeparatedMetadataComponentNames
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function convertToXml(component, data) {
  if (["CustomObject", "Workflow"].includes(component.parentType?.name)) {
    // remove first part of fullName separated by dot
    data.fullName = component.fullName.split(".")[1];
  } else {
    delete data.fullName;
  }
  return (
    new Builder({
      xmldec: {
        version: "1.0",
        encoding: "UTF-8",
      },
      rootName: component.type.name,
      renderOpts: {
        pretty: true,
        indent: "    ", // 4 spaces
        newline: "\n",
      },
    }).buildObject({
      ...data,
      ...{
        $: {
          xmlns: "http://soap.sforce.com/2006/04/metadata",
        },
      },
    }) + "\n"
  );
}

export function chunk<T>(input: T[], size: number): T[][] {
  return input.reduce((arr, item, idx) => {
    return idx % size === 0
      ? [...arr, [item]]
      : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
  }, [] as T[][]);
}

export function groupBy<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => string
) {
  return array.reduce((acc, value, index, array) => {
    (acc[predicate(value, index, array)] ||= []).push(value);
    return acc;
  }, {} as { [key: string]: T[] });
}
