import type { MetadataType as MetadataTypeName } from "@jsforce/jsforce-node/lib/api/metadata.js";
import type { Connection } from "@salesforce/core";

export async function fetchMetadataFromOrg(
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
