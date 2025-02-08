import { Flags, SfCommand } from "@salesforce/sf-plugins-core";
import {
  ComponentSetBuilder,
  ConvertOutputConfig,
  MetadataConverter,
} from "@salesforce/source-deploy-retrieve";
import { readComponentSetFromOrg } from "../../index.js";

export class CrudMdapiRead extends SfCommand<unknown> {
  public static readonly summary = "Read Metadata using the CRUD Metadata API";
  public static readonly description =
    "Read Metadata e.g. full Profiles using the CRUD Metadata API";

  public static readonly examples = [
    `$ <%= config.bin %> <%= command.id %> --metadata "Profile:Admin"`,
    `$ <%= config.bin %> <%= command.id %> --metadata "RecordType:Account.Business"`,
    `$ <%= config.bin %> <%= command.id %> --metadata "CustomObjectTranslation:Task-de"`,
    `$ <%= config.bin %> <%= command.id %> --source-dir force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml`,
  ];

  public static readonly flags = {
    "target-org": Flags.requiredOrg(),
    metadata: Flags.string({
      char: "m",
      summary: `Metadata component names to read.`,
      description: `Examples: 'RecordType:Account.Business', 'Profile:Admin'`,
      multiple: true,
      exclusive: ["manifest", "source-dir"],
    }),
    // manifest: Flags.file({
    //   char: "x",
    //   summary:
    //     "File path for the manifest (package.xml) that specifies the components to read.",
    //   exclusive: ["metadata", "source-dir"],
    //   exists: true,
    // }),
    "source-dir": Flags.string({
      char: "d",
      summary: `File paths for source to read from the org.`,
      description: `Examples: 'force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml', 'force-app/main/default/profiles/Admin.profile-meta.xml'`,
      multiple: true,
      exclusive: ["manifest", "metadata"],
    }),
    "output-dir": Flags.directory({
      char: "r",
      summary: "Directory root for the retrieved source files.",
    }),
    "chunk-size": Flags.integer({
      summary: "Number of components to be read per API call.",
      description:
        "The limit for readMetadata() is 10. For CustomMetadata and CustomApplication only, the limit is 200.",
      max: 10,
      default: 10,
    }),
  };

  public static readonly requiresProject = true;

  public async run(): Promise<any> {
    const { flags } = await this.parse(CrudMdapiRead);

    const componentSet = await ComponentSetBuilder.build({
      sourcepath: flags["source-dir"],
      ...(flags.metadata
        ? {
            metadata: {
              metadataEntries: flags.metadata,
              directoryPaths: flags["output-dir"]
                ? []
                : this.project
                    .getUniquePackageDirectories()
                    .map((dir) => dir.fullPath),
            },
          }
        : {}),
    });
    const connection = flags["target-org"].getConnection();
    const readComponentSet = await readComponentSetFromOrg(
      componentSet,
      connection,
      flags["chunk-size"]
    );

    const outputConfig: ConvertOutputConfig = {
      type: "merge",
      mergeWith: [],
      defaultDirectory:
        flags["output-dir"] ?? this.project.getDefaultPackage().path,
    };
    const convertResult = await new MetadataConverter().convert(
      readComponentSet,
      "source",
      outputConfig
    );

    console.log("Read Source");
    console.table([
      ...new Set(
        convertResult.converted.map((c) => ({
          Name: c.fullName,
          Type: c.type.name,
          Path: c.xml,
        }))
      ),
    ]);
  }
}
