import {
  CustomField,
  CustomObject,
  CustomObjectTranslation,
  Translations,
} from "@jsforce/jsforce-node/lib/api/metadata.js";
import {
  MetadataComponent,
  RegistryAccess,
} from "@salesforce/source-deploy-retrieve";

const registry = new RegistryAccess();

export const customObjectMetadataComponent: MetadataComponent = {
  fullName: "Account",
  type: registry.getTypeByName("CustomObject"),
};
export const customObject: CustomObject = {
  fullName: "Account",
  actionOverrides: [],
  businessProcesses: [],
  compactLayouts: [],
  fieldSets: [],
  fields: [],
  indexes: [],
  listViews: [],
  profileSearchLayouts: [],
  recordTypes: [],
  sharingReasons: [],
  sharingRecalculations: [],
  validationRules: [],
  webLinks: [],
};

export const customObjectTranslationMetadataComponent: MetadataComponent = {
  fullName: "Dummy__c-en_US",
  type: registry.getTypeByName("CustomObjectTranslation"),
};

export const customObjectTranslation: CustomObjectTranslation = {
  fullName: "Dummy__c-en_US",
  fields: [
    {
      help: "TEST help text",
      label: "TEST Type",
      name: "Type__c",
      caseValues: [],
      picklistValues: [],
    },
  ],
  caseValues: [],
  fieldSets: [],
  layouts: [],
  quickActions: [],
  recordTypes: [],
  sharingReasons: [],
  standardFields: [],
  validationRules: [],
  webLinks: [],
  workflowTasks: [],
};

export const customFieldMetadataComponent: MetadataComponent = {
  fullName: "Account.Industry",
  type: registry.getTypeByName("CustomField"),
  parent: {
    fullName: "Account",
    type: registry.getTypeByName("CustomObject"),
  },
};

export const customField: CustomField = {
  fullName: "Account.Industry",
  summaryFilterItems: [],
  trackFeedHistory: false,
  type: "Picklist",
};

export const translationsMetadataComponent: MetadataComponent = {
  fullName: "en_US",
  type: registry.getTypeByName("Translations"),
};

export const translations: Translations = {
  fullName: "en_US",
  customApplications: [],
  customDataTypeTranslations: [],
  customLabels: [
    {
      label: "Hello",
      name: "Greeting",
    },
  ],
  customPageWebLinks: [],
  customTabs: [],
  flowDefinitions: [],
  quickActions: [],
  reportTypes: [],
  scontrols: [],
};
