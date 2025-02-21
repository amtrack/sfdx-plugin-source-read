import type { MetadataType as MetadataTypeName } from "@jsforce/jsforce-node/lib/api/metadata.js";
import type { Connection } from "@salesforce/core";
import {
  ComponentSet,
  MetadataConverter,
  RegistryAccess,
  type MetadataComponent,
} from "@salesforce/source-deploy-retrieve";
import { fetchMetadataFromOrg } from "./crud-mdapi.js";
import { createSourceComponentWithMetadata } from "./source-component.js";
import { groupBy, determineMaxChunkSize, chunk } from "./utils.js";

type File = { type: string; fullName: string; filePath: string };

export async function writeComponentSetToDisk(
  componentSet: ComponentSet,
  outputDirectory: string
): Promise<File[]> {
  // NOTE: source-to-source conversion somehow produces incorrect file results for certain metadata types
  // Examples issues:
  // - Profile: Standard.profile-meta EmailServicesFunction force-app/main/default/profiles/Standard.profile-meta.xml-meta.xml
  // - Translation: de.translation-meta EmailServicesFunction foo/main/default/translations/de.translation-meta.xml-meta.xml
  // Workaround: make sure file paths don't end with -meta.xml
  const convertResult = await new MetadataConverter().convert(
    componentSet,
    "source",
    {
      type: "merge",
      mergeWith: [],
      defaultDirectory: outputDirectory,
    }
  );
  const files: File[] = convertResult.converted.map((c) => ({
    fullName: c.fullName,
    type: c.type.name,
    filePath: c.xml,
  }));
  return files;
}
export async function readFromOrg(
  componentSet: ComponentSet,
  connection: Connection,
  maxChunkSize?: number
): Promise<ComponentSet> {
  const componentsByType = groupBy(
    componentSet.toArray(),
    (cmp) => cmp.type.name
  );
  const resultSet = new ComponentSet();
  const registry = new RegistryAccess();

  for (const [typeName, metadataComponents] of Object.entries(
    componentsByType
  )) {
    const parentType = registry.getParentType(typeName);
    const metadataComponentsWithParents = addFakeParentToMetadataComponents(
      parentType,
      metadataComponents
    );
    const chunkSize =
      maxChunkSize ?? determineMaxChunkSize(typeName as MetadataTypeName);

    for (const chunkOfComponents of chunk(
      metadataComponentsWithParents,
      chunkSize
    )) {
      const metadataResults = await fetchMetadataFromOrg(
        connection,
        typeName,
        chunkOfComponents.map((cmp) => cmp.fullName)
      );
      for (const [index, metadataResult] of metadataResults.entries()) {
        const metadataComponent = chunkOfComponents[index];
        if (!metadataResult?.fullName) {
          throw new Error(
            `Failed to retrieve ${metadataComponent.type.name}:${metadataComponent.fullName}`
          );
        }
        const component = await createSourceComponentWithMetadata(
          metadataComponent,
          metadataResult
        );
        resultSet.add(component);
      }
    }
  }

  return resultSet;
}
export function addFakeParentToMetadataComponents(
  parentType,
  metadataComponents: MetadataComponent[]
) {
  return !parentType
    ? metadataComponents
    : metadataComponents.map((mc) => {
        if (mc.parent) {
          return mc;
        }
        return {
          ...mc,
          parent: {
            // Is there a more reliable way to get parentName?
            fullName: mc.fullName.split(".")[0],
            type: parentType,
          },
        };
      });
}
