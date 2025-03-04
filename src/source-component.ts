import type { Metadata } from "@jsforce/jsforce-node/lib/api/metadata.js";
import {
  SourceComponent,
  ZipTreeContainer,
  type MetadataComponent,
} from "@salesforce/source-deploy-retrieve";
import {
  JsToXml,
  ZipWriter,
} from "@salesforce/source-deploy-retrieve/lib/src/convert/streams.js";
import { ComponentProperties } from "@salesforce/source-deploy-retrieve/lib/src/resolve/sourceComponent.js";
import { filePathsFromMetadataComponent } from "@salesforce/source-deploy-retrieve/lib/src/utils/filePathGenerator.js";

/**
 * Creates a SourceComponent with zipped content in Metadata format.
 * @param metadataComponent A MetadataComponent with parent if it has one
 * @param metadataResult The raw response of connection.metadata.read()
 * @returns SourceComponent with zipped content in Metadata format
 */
export async function createSourceComponentWithMetadata(
  metadataComponent: MetadataComponent,
  metadataResult: Metadata
): Promise<SourceComponent> {
  const filePaths = filePathsFromMetadataComponent(metadataComponent);
  const componentProps: ComponentProperties = {
    type: metadataComponent.type,
    name: metadataComponent.fullName,
    xml: filePaths.find((p) =>
      p.endsWith(`.${metadataComponent.type.suffix}-meta.xml`)
    ),
  };
  if (metadataComponent.parent) {
    componentProps.parentType = metadataComponent.parent.type;
    componentProps.parent = new SourceComponent({
      type: metadataComponent.parent.type,
      name: metadataComponent.parent.fullName,
      // xml: filePaths.find((p) =>
      //   p.endsWith(`.${metadataComponent.parent.type.suffix}-meta.xml`)
      // ),
    });
    // Is there a more reliable way to get childName?
    componentProps.name = componentProps.name.split(".")?.[1];
  }
  const xmlObject = {
    [metadataComponent.type.name]: {
      ...metadataResult,
      ...(["CustomObject", "Workflow"].includes(
        metadataComponent.parent?.type.name
      )
        ? {
            fullName: metadataComponent.fullName.split(".")[1],
          }
        : {}),
    },
  };
  const xmlStream = new JsToXml(xmlObject);
  const tree = await createZipContainer(xmlStream, componentProps.xml);
  return new SourceComponent(componentProps, tree);
}

async function createZipContainer(
  xmlStream: JsToXml,
  xmlPath: string
): Promise<ZipTreeContainer> {
  const zipWriter = new ZipWriter();
  zipWriter.addToZip(xmlStream, xmlPath);
  await new Promise<void>((resolve, reject) => {
    zipWriter._final((err?) => {
      if (err) {
        console.error(err);
        return reject(err);
      }
      return resolve();
    });
  });
  return ZipTreeContainer.create(zipWriter.buffer);
}

/**
 * Clones a SourceComponent to a new filePath.
 * @param sourceComponent
 * @param fn new filePath
 * @returns
 */
export async function cloneSourceComponent(
  sourceComponent: SourceComponent,
  fn: (filePath: string) => string
): Promise<SourceComponent> {
  if (!sourceComponent.xml) {
    return sourceComponent;
  }
  const xml = fn(sourceComponent.xml);
  let parent: SourceComponent | undefined;
  if (sourceComponent.parent) {
    parent = await cloneSourceComponent(sourceComponent.parent, fn);
  }
  const xmlObject = await sourceComponent.parseXml(sourceComponent.xml);
  const xmlStream = new JsToXml(xmlObject);
  const tree = await createZipContainer(xmlStream, xml);
  const clone = new SourceComponent(
    {
      ...sourceComponent,
      xml,
      ...(parent ? { parent } : {}),
    },
    tree ?? tree
  );
  return clone;
}
