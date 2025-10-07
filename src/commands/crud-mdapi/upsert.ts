import { Flags, SfCommand } from "@salesforce/sf-plugins-core";
import { ComponentSetBuilder } from "@salesforce/source-deploy-retrieve";
import { upsertInOrg } from "../../component-set.js";

export class CrudMdapiUpdate extends SfCommand<unknown> {
  public static readonly summary =
    "Update Metadata using the CRUD Metadata API";
  public static readonly description =
    "Update Metadata e.g. full Profiles using the CRUD Metadata API.";

  public static readonly examples = [
    `$ <%= config.bin %> <%= command.id %> --metadata "Profile:Admin" --metadata "Profile:Standard"`,
    `$ <%= config.bin %> <%= command.id %> --metadata "RecordType:Account.Business"`,
    `$ <%= config.bin %> <%= command.id %> --metadata "CustomObjectTranslation:Task-de"`,
    `$ <%= config.bin %> <%= command.id %> --source-dir force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml`,
  ];

  public static readonly flags = {
    "target-org": Flags.requiredOrg(),
    metadata: Flags.string({
      char: "m",
      summary: `Metadata component names to update.`,
      description: `Example values: 'RecordType:Account.Business', 'Profile:Admin'`,
      multiple: true,
      exclusive: ["manifest", "source-dir"],
    }),
    manifest: Flags.file({
      char: "x",
      summary:
        "File path for the manifest (package.xml) that specifies the components to update.",
      exclusive: ["metadata", "source-dir"],
      exists: true,
    }),
    "source-dir": Flags.string({
      char: "d",
      summary: `File paths for source to update to the org.`,
      description: `Example values: 'force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml', 'force-app/main/default/profiles/Admin.profile-meta.xml'`,
      multiple: true,
      exclusive: ["manifest", "metadata"],
    }),
    "chunk-size": Flags.integer({
      summary: "Number of components to be update per API call.",
      description:
        "The limit for updateMetadata() is 10. For CustomMetadata and CustomApplication only, the limit is 200.",
      max: 10,
      default: 10,
    }),
  };

  public static readonly requiresProject = true;

  public async run(): Promise<unknown> {
    const { flags } = await this.parse(CrudMdapiUpdate);

    // 1/4 build a ComponentSet from the flags
    const componentSet = await ComponentSetBuilder.build({
      sourcepath: flags["source-dir"],
      ...(flags.manifest
        ? {
            manifest: {
              manifestPath: flags.manifest,
              directoryPaths: this.project
                .getUniquePackageDirectories()
                .map((dir) => dir.fullPath),
            },
          }
        : {}),
      ...(flags.metadata
        ? {
            metadata: {
              metadataEntries: flags.metadata,
              directoryPaths: this.project
                .getUniquePackageDirectories()
                .map((dir) => dir.fullPath),
            },
          }
        : {}),
    });

    // 2/4 update the components from the componentSet in the org
    const connection = flags["target-org"].getConnection();
    const upsertedComponentSet = await upsertInOrg(
      componentSet,
      connection,
      flags["chunk-size"]
    );

    // 3/4 write the components of the ComponentSet to disk
    const files = upsertedComponentSet
      .getSourceComponents()
      .map((c) => ({
        fullName: c.fullName,
        type: c.type.name,
        filePath: c.xml,
      }))
      .toArray();

    // 4/4 print the result: type, name and file path
    this.styledHeader("Upserted Source");
    this.table({
      data: files,
      columns: [
        { name: "Name", key: "fullName" },
        { name: "Type", key: "type" },
        { name: "Path", key: "filePath" },
      ],
    });
    return {
      success: true,
      files,
    };
  }
}
