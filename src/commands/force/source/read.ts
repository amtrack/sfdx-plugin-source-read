import type { MetadataType } from "@jsforce/jsforce-node/lib/api/metadata.js";
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from "@salesforce/sf-plugins-core";
import {
  ComponentSetBuilder,
  SourceComponent,
} from "@salesforce/source-deploy-retrieve";
import { filePathsFromMetadataComponent } from "@salesforce/source-deploy-retrieve/lib/src/utils/filePathGenerator.js";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import {
  chunk,
  convertToXml,
  parseCommaSeparatedValues,
} from "../../../utils.js";

export class SourceReadCommand extends SfCommand<any> {
  public static state = "deprecated";
  public static deprecationOptions = {
    message: `The 'sf force source read' command is deprecated and will be removed in the next major version.
Please migrate to 'sf crud-mdapi read': https://github.com/amtrack/sfdx-plugin-source-read/wiki/Migration#sf-crud-mdapi-read`,
  };
  public static readonly summary = "Read Metadata using the CRUD Metadata API";
  public static readonly description =
    "Read Metadata e.g. full Profiles using the CRUD Metadata API";

  public static readonly examples = [
    `$ <%= config.bin %> <%= command.id %> -m "Profile:Admin"`,
    `$ <%= config.bin %> <%= command.id %> -m "RecordType:Account.Business"`,
    `$ <%= config.bin %> <%= command.id %> -m "CustomObjectTranslation:Task-de"`,
    `$ <%= config.bin %> <%= command.id %> -p force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml`,
  ];

  public static readonly flags = {
    "target-org": requiredOrgFlagWithDeprecations,
    metadata: Flags.string({
      char: "m",
      summary: `comma-separated list of metadata component names
      Example: 'RecordType:Account.Business,Profile:Admin'`,
    }),
    sourcepath: Flags.string({
      char: "p",
      summary: `comma-separated list of source file paths to retrieve
      Example: 'force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml,force-app/main/default/profiles/Admin.profile-meta.xml'`,
    }),
    "chunk-size": Flags.integer({
      summary: "number of components to be read per API call",
      description:
        "The limit for readMetadata() is 10. For CustomMetadata and CustomApplication only, the limit is 200.",
      max: 10,
      default: 10,
    }),
  };

  public static readonly requiresProject = true;

  public async run(): Promise<any> {
    const { flags } = await this.parse(SourceReadCommand);
    const conn = flags["target-org"].getConnection();
    const packageDirectories = this.project.getPackageDirectories();
    const defaultPackageDirectory = this.project.getDefaultPackage().path;
    const sourcePaths = packageDirectories.map((dir) => dir.path);
    const componentSet = await ComponentSetBuilder.build({
      sourcepath:
        flags.sourcepath && parseCommaSeparatedValues(flags.sourcepath),
      ...(flags.metadata && {
        metadata: {
          metadataEntries: parseCommaSeparatedValues(flags.metadata),
          directoryPaths: sourcePaths,
        },
      }),
    });
    const manifestObject = await componentSet.getObject();
    const sourceComponents = componentSet.getSourceComponents();
    for (const typeMember of manifestObject.Package.types) {
      const typeName = typeMember.name;
      // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm
      const chunkSize =
        typeName === "CustomApplication" || typeName === "CustomMetadata"
          ? 200
          : flags["chunk-size"];
      for (const chunkOfMemberNames of chunk(typeMember.members, chunkSize)) {
        const componentNames = chunkOfMemberNames.map(
          (memberName) => `${typeName}:${memberName}`
        );
        this.log("reading", `${componentNames.join(", ")}`, "...");
        const metadataResults = await conn.metadata.read(
          typeName as MetadataType,
          chunkOfMemberNames
        );
        for (const metadataResult of metadataResults) {
          let filePath;
          const component =
            sourceComponents.find(
              (cmp) =>
                cmp.type.name === typeName &&
                cmp.fullName === metadataResult.fullName
            ) ||
            componentSet.find(
              (cmp) =>
                cmp.type.name === typeName &&
                cmp.fullName === metadataResult.fullName
            );
          if (component instanceof SourceComponent) {
            filePath = component.xml;
          } else {
            filePath = filePathsFromMetadataComponent(
              component,
              join(defaultPackageDirectory, "main", "default")
            ).find((p) => p.endsWith(`.${component.type.suffix}-meta.xml`));
            await mkdir(dirname(filePath), { recursive: true });
          }
          await writeFile(filePath, convertToXml(component, metadataResult));
        }
      }
    }
    return;
  }
}
