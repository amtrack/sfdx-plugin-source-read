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
        let props;
        let obj;
        if (parentType) {
          // TODO: more reliable way to get parent and childname
          const [parentName, childName] = metadataResult.fullName.split(".");
          props = {
            type: parentType,
            name: parentName,
            xml: `${parentType.directoryName}/${parentName}.${parentType.suffix}`,
          };
          metadataResult.fullName = childName;
          obj = Object.fromEntries([
            [
              parentType.name,
              Object.fromEntries([[mdType.directoryName, metadataResult]]),
            ],
          ]);
        } else {
          props = {
            type: mdType,
            name: metadataResult.fullName,
            xml: `${mdType.directoryName}/${metadataResult.fullName}.${mdType.suffix}`,
          };
          obj = Object.fromEntries([[typeName, metadataResult]]);
        }
        const stream = new JsToXml(obj);
        const zipBuffer = new ZipWriter();
        zipBuffer.addToZip(stream, props.xml);
        await zipBuffer._final((err?) => {
          if (err) {
            console.error(err);
          }
        });
        const zipTreeContainer = await ZipTreeContainer.create(
          zipBuffer.buffer
        );
        result.add(new SourceComponent(props, zipTreeContainer));
      }
    }
  }
  return result;
}
