import type { MetadataType as MetadataTypeName } from "@jsforce/jsforce-node/lib/api/metadata.js";
import type { Connection } from "@salesforce/core";
import {
  ComponentSet,
  MetadataConverter,
  MetadataResolver,
  RegistryAccess,
  SourceComponent,
  ZipTreeContainer,
  type MetadataComponent,
} from "@salesforce/source-deploy-retrieve";
import { basename, dirname, join } from "node:path";
import { fetchMetadataFromOrg } from "./crud-mdapi.js";
import {
  cloneSourceComponent,
  createSourceComponentWithMetadata,
} from "./source-component.js";
import { chunk, determineMaxChunkSize, groupBy } from "./utils.js";

type File = { type: string; fullName: string; filePath: string };

export async function writeComponentSetToDisk(
  componentSet: ComponentSet,
  outputDirectory: string,
  mergeWith: Iterable<SourceComponent> = []
): Promise<File[]> {
  // NOTE: source-to-source conversion somehow produces incorrect file results for certain metadata types
  // Examples issues:
  // - Profile: Standard.profile-meta EmailServicesFunction force-app/main/default/profiles/Standard.profile-meta.xml-meta.xml
  // - Translation: de.translation-meta EmailServicesFunction foo/main/default/translations/de.translation-meta.xml-meta.xml
  // Workaround: make sure file paths don't end with -meta.xml
  const tempComponentSet = new ComponentSet();
  for (const sourceComponent of componentSet.getSourceComponents()) {
    tempComponentSet.add(
      await cloneSourceComponent(sourceComponent, (filePath) =>
        filePath.replace("-meta.xml", "")
      )
    );
  }

  // `converted` reports one duplicate entry per written file for
  // "topLevel"-decomposed types (e.g. CustomObjectTranslation), all
  // misattributed to the parent component. Converting once into an
  // in-memory zip and resolving components directly from it lets us
  // safely call getChildren() on the parent to learn which children were
  // actually written and their file names, without the risk of also
  // picking up unrelated pre-existing files that happen to sit next to
  // the real merge target (or touching disk).
  const registry = new RegistryAccess();
  const { zipBuffer } = await new MetadataConverter().convert(
    tempComponentSet,
    "source",
    { type: "zip" }
  );
  const zipTree = await ZipTreeContainer.create(zipBuffer);
  const scratchComponents = new MetadataResolver(
    registry,
    zipTree
  ).getComponentsFromPath(".");
  const composedChildrenByParent = new Map(
    new ComponentSet(scratchComponents, registry)
      .getSourceComponents()
      .toArray()
      .map((c) => [`${c.type.name}:${c.fullName}`, c.getChildren()])
  );

  const convertResult = await new MetadataConverter().convert(
    tempComponentSet,
    "source",
    {
      type: "merge",
      mergeWith,
      defaultDirectory: outputDirectory,
    }
  );
  const files: File[] = new ComponentSet(convertResult.converted, registry)
    .getSourceComponents()
    .toArray()
    .flatMap((c) => {
      const children =
        composedChildrenByParent.get(`${c.type.name}:${c.fullName}`) ?? [];
      return [
        { fullName: c.fullName, type: c.type.name, filePath: c.xml },
        ...children.map((child) => ({
          fullName: child.fullName,
          type: child.type.name,
          filePath:
            c.xml && child.xml ? join(dirname(c.xml), basename(child.xml)) : "",
        })),
      ];
    });
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
