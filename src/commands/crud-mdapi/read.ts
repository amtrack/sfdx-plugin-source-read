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
    "Read Metadata e.g. full Profiles using the CRUD Metadata API, convert the JSON result to XML and write as source format to disk.";

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
    manifest: Flags.file({
      char: "x",
      summary:
        "File path for the manifest (package.xml) that specifies the components to read.",
      exclusive: ["metadata", "source-dir"],
      exists: true,
    }),
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

  public async run(): Promise<unknown> {
    const { flags } = await this.parse(CrudMdapiRead);

    // 1/4 build a ComponentSet from the flags
    const componentSet = await ComponentSetBuilder.build({
      sourcepath: flags["source-dir"],
      ...(flags.manifest
        ? {
            manifest: {
              manifestPath: flags.manifest,
              directoryPaths: flags["output-dir"]
                ? []
                : this.project
                    .getUniquePackageDirectories()
                    .map((dir) => dir.fullPath),
            },
          }
        : {}),
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

    // 2/4 read the components from the org to a new ComponentSet
    const connection = flags["target-org"].getConnection();
    const readComponentSet = await readComponentSetFromOrg(
      componentSet,
      connection,
      flags["chunk-size"]
    );

    // 3/4 write the components of the ComponentSet to disk
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

    // 4/4 display the written files
    const files = [
      ...new Set(
        convertResult.converted.map((c) => ({
          fullName: c.fullName,
          type: c.type.name,
          filePath: c.xml,
        }))
      ),
    ];
    this.styledHeader("Read Source");
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
