import type {
  Metadata,
  MetadataType as MetadataTypeName,
} from "@jsforce/jsforce-node/lib/api/metadata.js";
import type { Connection } from "@salesforce/core";
import {
  ComponentSet,
  MetadataConverter,
  MetadataResolver,
  MetadataType,
  RegistryAccess,
  SourceComponent,
  ZipTreeContainer,
  type MetadataComponent,
} from "@salesforce/source-deploy-retrieve";
import { basename, dirname, join, relative } from "node:path";
import { fetchMetadataFromOrg, upsertMetadataInOrg } from "./crud-mdapi.js";
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
    {
      type: "zip",
    }
  );
  if (!zipBuffer) {
    throw new Error("zipBuffer is undefined");
  }
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
    })
    .map((file) => ({
      ...file,
      filePath: file.filePath ? relative(process.cwd(), file.filePath) : "",
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
  const registry = new RegistryAccess();
  const resultSet = new ComponentSet();

  for (const [typeName, metadataComponents] of Object.entries(
    componentsByType
  )) {
    for (const component of await readComponentsOfType(
      connection,
      registry,
      typeName,
      metadataComponents,
      maxChunkSize
    )) {
      resultSet.add(component);
    }
  }

  return resultSet;
}

/**
 * Composes a decomposed child's metadata into its parent's array field, or
 * returns undefined if the child is independently addressable (and thus
 * not part of the parent's payload).
 */
function composeChildMetadata(
  child: SourceComponent,
  directories: Record<string, string>
): [arrayKey: string, childMetadata: Metadata] | undefined {
  if (child.type.isAddressable !== false) {
    return undefined;
  }
  const arrayKey = Object.entries(directories).find(
    ([, typeId]) => typeId === child.type.id
  )?.[0];
  if (!arrayKey) {
    return undefined;
  }
  const childXml = child.parseXmlSync();
  const childMetadata = childXml[child.type.name] as Metadata;
  delete childMetadata["@_xmlns"];
  return [arrayKey, childMetadata];
}

/**
 * Builds the Metadata payload for a source component, composing in any
 * decomposed children that aren't independently addressable via the
 * Metadata API (e.g. CustomFieldTranslation is only reachable through its
 * parent CustomObjectTranslation).
 */
function composeMetadata(sourceComponent: SourceComponent): Metadata {
  const typeName = sourceComponent.type.name;
  const xml = sourceComponent.parseXmlSync();
  const metadata = { ...(xml[typeName] as Metadata) };
  delete metadata["@_xmlns"];

  const directories = sourceComponent.type.children?.directories ?? {};
  const composedChildren = sourceComponent
    .getChildren()
    .map((child) => composeChildMetadata(child, directories))
    .filter((composed) => composed !== undefined);
  const childrenByArrayKey = groupBy(
    composedChildren,
    ([arrayKey]) => arrayKey
  );
  for (const [arrayKey, entries] of Object.entries(childrenByArrayKey)) {
    metadata[arrayKey] = entries.map(([, childMetadata]) => childMetadata);
  }
  return metadata;
}

export async function upsertInOrg(
  componentSet: ComponentSet,
  connection: Connection,
  maxChunkSize?: number
): Promise<ComponentSet> {
  const componentsByType = groupBy(
    componentSet.toArray(),
    (cmp) => cmp.type.name
  );
  const resultSet = new ComponentSet();

  const allSourceComponents = componentSet.getSourceComponents().toArray();
  for (const [typeName, metadataComponents] of Object.entries(
    componentsByType
  )) {
    for (const component of await upsertComponentsOfType(
      connection,
      allSourceComponents,
      typeName,
      metadataComponents,
      maxChunkSize
    )) {
      resultSet.add(component);
    }
  }

  return resultSet;
}

async function upsertComponentsOfType(
  connection: Connection,
  allSourceComponents: SourceComponent[],
  typeName: string,
  metadataComponents: MetadataComponent[],
  maxChunkSize?: number
): Promise<MetadataComponent[]> {
  const chunkSize =
    maxChunkSize ?? determineMaxChunkSize(typeName as MetadataTypeName);

  const components: MetadataComponent[] = [];
  for (const chunkOfComponents of chunk(metadataComponents, chunkSize)) {
    components.push(
      ...(await upsertChunkInOrg(
        connection,
        allSourceComponents,
        typeName,
        chunkOfComponents
      ))
    );
  }
  return components;
}

async function upsertChunkInOrg(
  connection: Connection,
  allSourceComponents: SourceComponent[],
  typeName: string,
  chunkOfComponents: MetadataComponent[]
): Promise<MetadataComponent[]> {
  const metadataWithFullNames = chunkOfComponents.map((cmp) => {
    const sourceComponent = allSourceComponents.find(
      (sc) => sc.type.name === typeName && sc.fullName === cmp.fullName
    );
    if (!sourceComponent) {
      throw new Error(`Failed to find source for ${typeName}:${cmp.fullName}`);
    }
    return {
      ...composeMetadata(sourceComponent),
      fullName: cmp.fullName,
    };
  });

  const metadataResults = await upsertMetadataInOrg(
    connection,
    typeName,
    metadataWithFullNames
  );
  return validateMetadataResults(chunkOfComponents, metadataResults, "upsert");
}

/**
 * Confirms every metadata result in a chunk came back with a fullName,
 * throwing on the first component whose result is missing one.
 */
function validateMetadataResults(
  chunkOfComponents: MetadataComponent[],
  metadataResults: Array<{ fullName?: string } | undefined>,
  action: string
): MetadataComponent[] {
  return chunkOfComponents.map((metadataComponent, index) => {
    const metadataResult = metadataResults[index];
    if (!metadataResult?.fullName) {
      throw new Error(
        `Failed to ${action} ${metadataComponent.type.name}:${metadataComponent.fullName}`
      );
    }
    return metadataComponent;
  });
}

async function readComponentsOfType(
  connection: Connection,
  registry: RegistryAccess,
  typeName: string,
  metadataComponents: MetadataComponent[],
  maxChunkSize?: number
): Promise<SourceComponent[]> {
  const metadataComponentsWithParents = addFakeParentToMetadataComponents(
    registry.getParentType(typeName),
    metadataComponents
  );
  const chunkSize =
    maxChunkSize ?? determineMaxChunkSize(typeName as MetadataTypeName);

  const components: SourceComponent[] = [];
  for (const chunkOfComponents of chunk(
    metadataComponentsWithParents,
    chunkSize
  )) {
    components.push(
      ...(await readChunkFromOrg(connection, typeName, chunkOfComponents))
    );
  }
  return components;
}

async function readChunkFromOrg(
  connection: Connection,
  typeName: string,
  chunkOfComponents: MetadataComponent[]
): Promise<SourceComponent[]> {
  const metadataResults = await fetchMetadataFromOrg(
    connection,
    typeName,
    chunkOfComponents.map((cmp) => cmp.fullName)
  );
  const validated = validateMetadataResults(
    chunkOfComponents,
    metadataResults,
    "retrieve"
  );
  const components: SourceComponent[] = [];
  for (const [index, metadataComponent] of validated.entries()) {
    components.push(
      await createSourceComponentWithMetadata(
        metadataComponent,
        metadataResults[index]
      )
    );
  }
  return components;
}

function addFakeParentToMetadataComponents(
  parentType: MetadataType | undefined,
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
