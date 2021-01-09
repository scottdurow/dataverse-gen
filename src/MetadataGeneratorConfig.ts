import { Dictionary } from "cdsify";

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
      import: "cdsify",
    },
    Entity: {
      name: "IEntity",
      import: "cdsify",
    },
    EntityReference: {
      name: "EntityReference",
      import: "cdsify",
    },
    WebApiExecuteRequest: {
      name: "WebApiExecuteRequest",
      import: "cdsify",
    },
    StructuralProperty: {
      name: "StructuralProperty",
      import: "cdsify",
    },
    OperationType: {
      name: "OperationType",
      import: "cdsify",
    },
    ActivityParty: {
      name: "ActivityParty",
      import: "cdsify",
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
  output: {
    useCache: false,
    outputRoot: "./src/dataverse-gen", // Default
    templateRoot: "./_templates",
    fileSuffix: ".ts",
  },
} as DataverseGenOptions;
