import type {
  MetadataType as MetadataTypeName,
  Metadata,
} from "@jsforce/jsforce-node/lib/api/metadata.js";
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

export async function upsertMetadataInOrg(
  connection: Connection,
  typeName: string,
  metadata: Metadata[]
) {
  const qualifiedNames = metadata.map((md) => `${typeName}:${md.fullName}`);
  console.error("upserting", qualifiedNames.join(", "), "...");
  const result = await connection.metadata.upsert(typeName, metadata);
  const errors = result.filter((r) => r.errors).flatMap((r) => r.errors);
  if (errors.length) {
    console.error(errors.map((e) => e.message).join("\n"));
    throw new AggregateError(errors, "Upserting failed");
  }
  return result;
}
