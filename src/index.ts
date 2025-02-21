import type {
  Metadata,
  MetadataType as MetadataTypeName,
} from "@jsforce/jsforce-node/lib/api/metadata.js";
import { type Connection } from "@salesforce/core";
import {
  ComponentSet,
  type MetadataComponent,
  RegistryAccess,
  SourceComponent,
  ZipTreeContainer,
} from "@salesforce/source-deploy-retrieve";
import {
  JsToXml,
  ZipWriter,
} from "@salesforce/source-deploy-retrieve/lib/src/convert/streams.js";
import { chunk, groupBy } from "./utils.js";

export async function readComponentSetFromOrg(
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
        const component = await convertToSourceComponent(
          metadataComponent,
          metadataResult
        );
        resultSet.add(component);
      }
    }
  }

  return resultSet;
}

function addFakeParentToMetadataComponents(
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

async function fetchMetadataFromOrg(
  connection: Connection,
  typeName: string,
  memberNames: string[]
) {
  const qualifiedNames = memberNames.map((name) => `${typeName}:${name}`);
  console.error("reading", qualifiedNames.join(", "), "...");
  return await connection.metadata.read(
    typeName as MetadataTypeName,
    memberNames
  );
}

/**
 * Determine the maximum number of members that can be read in a single call
 * using the CRUD-based Metadata API according to the Salesforce documentation.
 *
 *  > Limit: 10. (For CustomMetadata and CustomApplication only, the limit is 200.)
 *
 * Source: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm
 * @param typeName The MetadataType name
 * @returns The maximum number of members that can be read in a single call
 */
function determineMaxChunkSize(typeName: MetadataTypeName): number {
  const MAX_CHUNK_SIZE = 10;
  const MAX_CHUNK_SIZE_SPECIAL_TYPES = 200;
  const SPECIAL_TYPES = ["CustomApplication", "CustomMetadata"];
  return SPECIAL_TYPES.includes(typeName)
    ? MAX_CHUNK_SIZE_SPECIAL_TYPES
    : MAX_CHUNK_SIZE;
}

async function createZipContainer(
  xmlStream: JsToXml,
  xmlPath: string
): Promise<ZipTreeContainer> {
  const zipWriter = new ZipWriter();
  zipWriter.addToZip(xmlStream, xmlPath);
  await new Promise<void>((resolve, reject) => {
    zipWriter._final((err?) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      resolve();
    });
  });
  return ZipTreeContainer.create(zipWriter.buffer);
}

/**
 * Creates a SourceComponent with zipped content in Metadata format.
 * @param metadataComponent A MetadataComponent with parent if it has one
 * @param metadataResult The raw response of connection.metadata.read()
 * @returns SourceComponent with zipped content in Metadata format
 */
export async function convertToSourceComponent(
  metadataComponent: MetadataComponent,
  metadataResult: Metadata
): Promise<SourceComponent> {
  let metadataObj, componentProps;
  if (!metadataComponent.parent) {
    componentProps = {
      type: metadataComponent.type,
      name: metadataComponent.fullName,
      xml: `${metadataComponent.type.directoryName}/${metadataComponent.fullName}.${metadataComponent.type.suffix}`,
    };
    metadataObj = { [metadataComponent.type.name]: metadataResult };
  } else {
    componentProps = {
      type: metadataComponent.parent.type,
      name: metadataComponent.parent.fullName,
      xml: `${metadataComponent.parent.type.directoryName}/${metadataComponent.parent.fullName}.${metadataComponent.parent.type.suffix}`,
    };
    // TODO: Is there a more reliable way to get childName?
    const [_, childName] = metadataComponent.fullName.split(".");
    if (!childName) {
      throw new Error(
        `Failed to guess component child name for ${metadataComponent.type.name}:${metadataComponent.fullName}.`
      );
    }
    metadataObj = {
      [metadataComponent.parent.type.name]: {
        [metadataComponent.type.directoryName]: {
          ...metadataResult,
          fullName: childName,
        },
      },
    };
  }

  const xmlStream = new JsToXml(metadataObj);
  const zipContainer = await createZipContainer(xmlStream, componentProps.xml);

  return new SourceComponent(componentProps, zipContainer);
}
