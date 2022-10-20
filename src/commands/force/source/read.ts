import { flags, SfdxCommand } from "@salesforce/command";
import {
  ComponentSetBuilder,
  SourceComponent,
} from "@salesforce/source-deploy-retrieve";
import { filePathsFromMetadataComponent } from "@salesforce/source-deploy-retrieve/lib/src/utils/filePathGenerator";
import { mkdir, writeFile } from "fs/promises";
import type { MetadataType } from "jsforce/api/metadata";
import { dirname, join } from "path";
import { convertToXml, parseCommaSeparatedValues } from "../../../utils";

export class SourceReadCommand extends SfdxCommand {
  public static description = "Read Metadata using the CRUD Metadata API";

  public static examples = [
    `$ sfdx <%= command.id %> -m "Profile:Admin"`,
    `$ sfdx <%= command.id %> -m "RecordType:Account.Business"`,
    `$ sfdx <%= command.id %> -p force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml`,
  ];

  protected static flagsConfig = {
    metadata: flags.string({
      char: "m",
      description: `comma-separated list of metadata component names
      Example: 'RecordType:Account.Business,Profile:Admin'`,
    }),
    sourcepath: flags.string({
      char: "p",
      description: `comma-separated list of source file paths to retrieve
      Example: 'force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml,force-app/main/default/profiles/Admin.profile-meta.xml'`,
    }),
  };

  protected static requiresUsername = true;
  protected static requiresProject = true;

  public async run(): Promise<any> {
    const conn = this.org.getConnection();
    const packageDirectories = this.project.getPackageDirectories();
    const defaultPackageDirectory = this.project.getDefaultPackage().path;
    const sourcePaths = packageDirectories.map((dir) => dir.path);
    const componentSet = await ComponentSetBuilder.build({
      sourcepath:
        this.flags.sourcepath &&
        parseCommaSeparatedValues(this.flags.sourcepath),
      manifest: this.flags.manifest && {
        manifestPath: this.flags.manifest,
        directoryPaths: sourcePaths,
      },
      metadata: this.flags.metadata && {
        metadataEntries: parseCommaSeparatedValues(this.flags.metadata),
        directoryPaths: sourcePaths,
      },
    });
    for (const component of componentSet) {
      this.log(
        "reading",
        `${component.type.name}:${component.fullName}`,
        "..."
      );
      const mdJson = await conn.metadata.read(
        component.type.name as MetadataType,
        component.fullName
      );
      let filePath;
      if (component instanceof SourceComponent) {
        filePath = component.xml;
      } else {
        filePath = filePathsFromMetadataComponent(
          component,
          join(defaultPackageDirectory, "main", "default")
        ).find((p) => p.endsWith(`.${component.type.suffix}-meta.xml`));
        await mkdir(dirname(filePath), { recursive: true });
      }
      await writeFile(filePath, convertToXml(component, mdJson));
    }

    return;
  }
}
