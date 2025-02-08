import type { MetadataType as MetadataTypeName } from "@jsforce/jsforce-node/lib/api/metadata.js";
import { SfProject, type Connection } from "@salesforce/core";
import {
  ComponentSet,
  MetadataType,
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
  const registry = new RegistryAccess(
    undefined,
    SfProject.getInstance()?.getPath()
  );
  const componentsByType = groupBy(
    componentSet.toArray(),
    (cmp) => cmp.type.name
  );
  const resultSet = new ComponentSet();

  for (const [typeName, components] of Object.entries(componentsByType)) {
    const mdType = registry.getTypeByName(typeName);
    const parentType = registry.getParentType(typeName);
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

        const component = await convertMetadataToComponent(
          result,
          mdType,
          parentType
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
): Promise<any[]> {
  const qualifiedNames = memberNames.map((name) => `${typeName}:${name}`);
  console.log("reading", qualifiedNames.join(", "), "...");
  return await connection.metadata.read(
    typeName as MetadataTypeName,
    memberNames
  );
}

function determineMaxChunkSize(typeName: MetadataTypeName): number {
  // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm
  // > Limit: 10. (For CustomMetadata and CustomApplication only, the limit is 200.)
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

async function convertMetadataToComponent(
  metadataResult: any,
  mdType: MetadataType,
  parentType: MetadataType | null
): Promise<SourceComponent> {
  // TODO: more reliable way to get parent and childname
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
