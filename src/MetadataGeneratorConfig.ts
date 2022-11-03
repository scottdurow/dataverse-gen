/* eslint-disable sonarjs/no-duplicate-string */
import { Dictionary } from "dataverse-ify";

export interface OutputConfig {
  templateRoot?: string;
  outputRoot?: string;
  fileSuffix?: string;
  useCache?: boolean;
}
export interface ImportType {
  name?: string;
  import?: string;
}

export interface DataverseGenOptions {
  entities?: string[];
  actions?: string[];
  functions?: string[];
  output?: OutputConfig;
  generateIndex?: boolean;
  generateFormContext?: boolean;
  referencedTypes?: Dictionary<ImportType>;
}

export const defaultOptions = {
  entities: [],
  actions: [],
  functions: [],
  referencedTypes: {
    Object: {
      name: "ObjectValue",
    },
    Guid: {
      name: "Guid",
      import: "dataverse-ify",
    },
    Entity: {
      name: "IEntity",
      import: "dataverse-ify",
    },
    EntityReference: {
      name: "EntityReference",
      import: "dataverse-ify",
    },
    WebApiExecuteRequest: {
      name: "WebApiExecuteRequest",
      import: "dataverse-ify",
    },
    StructuralProperty: {
      name: "StructuralProperty",
      import: "dataverse-ify",
    },
    OperationType: {
      name: "OperationType",
      import: "dataverse-ify",
    },
    ActivityParty: {
      name: "ActivityParty",
      import: "dataverse-ify",
    },
    enums: {
      import: "../enums/",
    },
    complexTypes: {
      import: "../complextypes/",
    },
    entityTypes: {
      import: "../entities/",
    },
  },
  generateIndex: false,
  output: {
    useCache: false,
    outputRoot: "./src/dataverse-gen", // Default
    templateRoot: "./_templates",
    fileSuffix: ".ts",
  },
} as DataverseGenOptions;
