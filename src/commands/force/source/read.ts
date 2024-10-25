import type { MetadataType } from "@jsforce/jsforce-node/lib/api/metadata.js";
import { Flags, SfCommand, requiredOrgFlagWithDeprecations } from "@salesforce/sf-plugins-core";
import { ComponentSetBuilder, SourceComponent } from "@salesforce/source-deploy-retrieve";
import { filePathsFromMetadataComponent } from "@salesforce/source-deploy-retrieve/lib/src/utils/filePathGenerator.js";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { convertToXml, parseCommaSeparatedValues } from "../../../utils.js";

export class SourceReadCommand extends SfCommand<any> {
  public static readonly summary = "Read Metadata using the CRUD Metadata API";
  public static readonly description = "Read Metadata using the CRUD Metadata API";

  public static readonly examples = [
    `$ <%= config.bin %> <%= command.id %> -m "Profile:Admin"`,
    `$ <%= config.bin %> <%= command.id %> -m "RecordType:Account.Business"`,
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
  };

  public static readonly requiresProject = true;

  public async run(): Promise<any> {
    const { flags } = await this.parse(SourceReadCommand);
    const conn = flags["target-org"].getConnection();
    const packageDirectories = this.project.getPackageDirectories();
    const defaultPackageDirectory = this.project.getDefaultPackage().path;
    const sourcePaths = packageDirectories.map((dir) => dir.path);
    const componentSet = await ComponentSetBuilder.build({
      sourcepath: flags.sourcepath && parseCommaSeparatedValues(flags.sourcepath),
      ...(flags.metadata && {
        metadata: {
          metadataEntries: parseCommaSeparatedValues(flags.metadata),
          directoryPaths: sourcePaths,
        }
      }),
    });
    for (const component of componentSet) {
      this.log("reading", `${component.type.name}:${component.fullName}`, "...");
      const mdJson = await conn.metadata.read(component.type.name as MetadataType, component.fullName);
      let filePath;
      if (component instanceof SourceComponent) {
        filePath = component.xml;
      } else {
        filePath = filePathsFromMetadataComponent(component, join(defaultPackageDirectory, "main", "default")).find(
          (p) => p.endsWith(`.${component.type.suffix}-meta.xml`),
        );
        await mkdir(dirname(filePath), { recursive: true });
      }
      await writeFile(filePath, convertToXml(component, mdJson));
    }

    return;
  }
}
