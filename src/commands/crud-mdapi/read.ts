import { Flags, SfCommand } from "@salesforce/sf-plugins-core";
import { ComponentSetBuilder } from "@salesforce/source-deploy-retrieve";
import { readFromOrg, writeComponentSetToDisk } from "../../component-set.js";

type CrudMdapiReadResult = {
  success: boolean;
  files: Awaited<ReturnType<typeof writeComponentSetToDisk>>;
};

export class CrudMdapiRead extends SfCommand<CrudMdapiReadResult> {
  public static readonly summary = "Read Metadata using the CRUD Metadata API";
  public static readonly description =
    "Read Metadata e.g. full Profiles using the CRUD Metadata API, convert the JSON result to XML and write as source format to disk.";

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
      summary: `Metadata component names to read.`,
      description: `Example values: 'RecordType:Account.Business', 'Profile:Admin'`,
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
      description: `Example values: 'force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml', 'force-app/main/default/profiles/Admin.profile-meta.xml'`,
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

  public async run(): Promise<CrudMdapiReadResult> {
    const { flags } = await this.parse(CrudMdapiRead);

    // 1/4 build a ComponentSet from the flags
    const componentSet = await this.buildComponentSet(flags);

    // 2/4 read the components from the org to a new ComponentSet
    const readComponentSet = await readFromOrg(
      componentSet,
      flags["target-org"].getConnection(),
      flags["chunk-size"]
    );

    // 3/4 write the components of the ComponentSet to disk
    const files = await writeComponentSetToDisk(
      readComponentSet,
      flags["output-dir"] ?? this.project!.getDefaultPackage().path,
      flags["source-dir"] && !flags["output-dir"]
        ? componentSet.getSourceComponents()
        : []
    );

    // 4/4 print the result: type, name and file path
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

  private buildComponentSet(
    flags: Awaited<ReturnType<CrudMdapiRead["parse"]>>["flags"]
  ): ReturnType<typeof ComponentSetBuilder.build> {
    const directoryPaths = this.directoryPaths(flags["output-dir"]);
    return ComponentSetBuilder.build({
      sourcepath: flags["source-dir"],
      ...(flags.manifest
        ? { manifest: { manifestPath: flags.manifest, directoryPaths } }
        : {}),
      ...(flags.metadata
        ? { metadata: { metadataEntries: flags.metadata, directoryPaths } }
        : {}),
    });
  }

  private directoryPaths(outputDir: string | undefined): string[] {
    return outputDir
      ? []
      : this.project!.getUniquePackageDirectories().map((dir) => dir.fullPath);
  }
}
