import { flags, SfdxCommand } from "@salesforce/command";
import { ComponentSetBuilder } from "@salesforce/plugin-source/lib/componentSetBuilder";
import { writeFileSync } from "fs";
import { Builder } from "xml2js";

export default class SourceReadCommand extends SfdxCommand {
  public static description = "Read Metadata using the CRUD Metadata API";

  public static examples = [
    `$ sfdx force:source:read -m "Profile:Admin"`,
    `$ sfdx force:source:read -m "RecordType:Account.Business"`,
    `$ sfdx force:source:read -p force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml`
  ];

  protected static flagsConfig = {
    metadata: flags.string({
      char: "m",
      description: `comma-separated list of metadata component names
      Example: 'RecordType:Account.Business,Profile:Admin'`
    }),
    sourcepath: flags.string({
      char: "p",
      description: `comma-separated list of source file paths to retrieve
      Example: 'force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml,force-app/main/default/profiles/Admin.profile-meta.xml'`
    })
  };

  protected static requiresUsername = true;
  protected static requiresProject = true;

  public async run(): Promise<any> {
    const conn = this.org.getConnection();
    const sourcePaths = (await this.project.getPackageDirectories()).map(
      dir => dir.path
    );
    const componentSet = await ComponentSetBuilder.build({
      sourcepath:
        this.flags.sourcepath &&
        parseCommaSeparatedValues(this.flags.sourcepath),
      manifest: this.flags.manifest && {
        manifestPath: this.flags.manifest,
        directoryPaths: sourcePaths
      },
      metadata: this.flags.metadata && {
        metadataEntries: parseCommaSeparatedValues(this.flags.metadata),
        directoryPaths: sourcePaths
      }
    });
    for (const component of componentSet) {
      this.log(
        "reading",
        `${component.type.name}:${component.fullName}`,
        "..."
      );
      const mdJson = await conn.metadata.read(component.type.name, [
        component.fullName
      ]);
      writeFileSync(component["xml"], convertToXml(component, mdJson));
    }

    return;
  }
}

function parseCommaSeparatedValues(commaSeparatedMetadataComponentNames) {
  if (!commaSeparatedMetadataComponentNames) {
    return [];
  }
  return commaSeparatedMetadataComponentNames
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function convertToXml(component, data) {
  if (["CustomObject", "Workflow"].includes(component.parent?.type?.name)) {
    // remove first part of fullName separated by dot
    data.fullName = component.fullName.split(".")[1];
  } else {
    delete data.fullName;
  }
  return (
    new Builder({
      xmldec: {
        version: "1.0",
        encoding: "UTF-8"
      },
      rootName: component.type.name,
      renderOpts: {
        pretty: true,
        indent: "    ", // 4 spaces
        newline: "\n"
      }
    }).buildObject({
      ...data,
      ...{
        $: {
          xmlns: "http://soap.sforce.com/2006/04/metadata"
        }
      }
    }) + "\n"
  );
}
