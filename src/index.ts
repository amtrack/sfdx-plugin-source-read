import type { MetadataType as JsforceMetadataType } from "@jsforce/jsforce-node/lib/api/metadata.js";
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

export async function crudReadComponentSet(
  componentSet: ComponentSet,
  connection: Connection,
  defaultChunkSize: number
): Promise<ComponentSet> {
  const registry = new RegistryAccess(
    undefined,
    SfProject.getInstance()?.getPath()
  );
  const groupedByType = groupBy(componentSet.toArray(), (c) => c.type.name);

  const result = new ComponentSet();
  for (const [typeName, members] of Object.entries(groupedByType)) {
    const memberNames = members.map((m) => m.fullName);
    const mdType = registry.getTypeByName(typeName);
    const parentType = registry.getParentType(typeName);
    if (parentType) {
      throw new Error(
        `Reading child types (${typeName} < ${parentType.name}) is not yet implemented.`
      );
    }
    // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm
    const chunkSize =
      typeName === "CustomApplication" || typeName === "CustomMetadata"
        ? 200
        : defaultChunkSize;
    for (const chunkOfMemberNames of chunk(memberNames, chunkSize)) {
      const componentNames = chunkOfMemberNames.map(
        (memberName) => `${typeName}:${memberName}`
      );
      console.log("reading", `${componentNames.join(", ")}`, "...");
      const metadataResults = await connection.metadata.read(
        typeName as JsforceMetadataType,
        chunkOfMemberNames
      );

      for (const [i, metadataResult] of metadataResults.entries()) {
        if (!metadataResult?.fullName) {
          throw new Error(
            `Failed to retrieve ${typeName}:${chunkOfMemberNames[i]}.`
          );
        }
        const filePath = `${mdType.directoryName}/${metadataResult.fullName}.${mdType.suffix}`;
        const stream = new JsToXml(
          Object.fromEntries([[typeName, metadataResult]])
        );
        const zipBuffer = new ZipWriter();
        zipBuffer.addToZip(stream, filePath);
        await zipBuffer._final((err?) => {
          if (err) {
            console.error(err);
          }
        });
        const zipTreeContainer = await ZipTreeContainer.create(
          zipBuffer.buffer
        );
        result.add(
          new SourceComponent(
            {
              type: mdType,
              name: metadataResult.fullName,
              parentType,
              xml: filePath,
            },
            zipTreeContainer
          )
        );
      }
    }
  }
  return result;
}
