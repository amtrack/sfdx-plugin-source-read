import type {
  Metadata,
  MetadataType as MetadataTypeName,
} from "@jsforce/jsforce-node/lib/api/metadata.js";
import { SfProject, type Connection } from "@salesforce/core";
import {
  ComponentSet,
  RegistryAccess,
  SourceComponent,
  ZipTreeContainer,
} from "@salesforce/source-deploy-retrieve";
import {
  JsToXml,
  ZipWriter,
} from "@salesforce/source-deploy-retrieve/lib/src/convert/streams.js";
import { chunk, groupBy } from "./utils.js";

export type ReadOptions = {
  defaultPackageDirectory: string;
  outputDirectory?: string;
};

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

  for (const [typeName, components] of Object.entries(componentsByType)) {
    const memberNames = components.map((cmp) => cmp.fullName);
    const chunkSize =
      maxChunkSize ?? determineMaxChunkSize(typeName as MetadataTypeName);

    for (const memberNameChunk of chunk(memberNames, chunkSize)) {
      const metadataResults = await fetchMetadataFromOrg(
        connection,
        typeName,
        memberNameChunk
      );
      for (const [index, result] of metadataResults.entries()) {
        if (!result?.fullName) {
          throw new Error(
            `Failed to retrieve ${typeName}:${memberNameChunk[index]}`
          );
        }
        const component = await convertMetadataToSourceComponent(
          typeName,
          result
        );
        resultSet.add(component);
      }
    }
  }

  return resultSet;
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

async function convertMetadataToSourceComponent(
  typeName: string,
  metadataResult: Metadata
): Promise<SourceComponent> {
  const registry = new RegistryAccess(
    undefined,
    SfProject.getInstance()?.getPath()
  );
  const mdType = registry.getTypeByName(typeName);
  const parentType = registry.getParentType(mdType.name);
  // Is there a more reliable way to get parentName and childName?
  const [parentName, childName] = (metadataResult.fullName || "").split(".");
  const componentType = parentType || mdType;
  const componentName = parentType ? parentName : metadataResult.fullName;

  const componentProps = {
    type: componentType,
    name: componentName,
    xml: `${componentType.directoryName}/${componentName}.${componentType.suffix}`,
  };

  const metadataObj = parentType
    ? {
        [parentType.name]: {
          [mdType.directoryName]: { ...metadataResult, fullName: childName },
        },
      }
    : { [mdType.name]: metadataResult };

  const xmlStream = new JsToXml(metadataObj);
  const zipContainer = await createZipContainer(xmlStream, componentProps.xml);

  return new SourceComponent(componentProps, zipContainer);
}
