import { CdsifyOptions, defaultOptions } from "./MetadataGeneratorConfig";
import _merge = require("lodash.merge");
import ejs = require("ejs");
import path = require("path");
import * as fs from "fs";
import { WebApiStatic, NodeWebApiRequest } from "cdsify/lib/cdsnode";
import { SchemaGenerator } from "./SchemaGenerator";
import { XrmContextCdsServiceClient, setMetadataCache } from "cdsify";
import { getAccessToken } from "cdsify/lib/cdsnode/TokenCache";
import { metadataCache } from "./cds-generated/metadata";
import { ComplexEntityMetadata } from "./cds-generated/complextypes/ComplexEntityMetadata";
import { RetrieveMetadataChangesResponse } from "./cds-generated/complextypes/RetrieveMetadataChangesResponse";
import { MetadataConditionOperator } from "./cds-generated/enums/MetadataConditionOperator";
import { LogicalOperator } from "./cds-generated/enums/LogicalOperator";
import { RetrieveMetadataChangesRequest } from "./cds-generated/functions/RetrieveMetadataChanges";

export class TypescriptGenerator {
  packageDir: string;
  projectDir: string;
  options: CdsifyOptions;
  cdsService!: XrmContextCdsServiceClient;
  constructor(packageDir: string, projectDir: string, options: CdsifyOptions) {
    this.packageDir = packageDir;
    this.projectDir = projectDir;
    this.options = _merge(defaultOptions, options) as CdsifyOptions;
  }

  async generate(server: string): Promise<void> {
    const nodeWebApi = new WebApiStatic();
    await nodeWebApi.authoriseWithCdsAuthToken(server, "9.1");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.cdsService = new XrmContextCdsServiceClient((nodeWebApi as any) as Xrm.WebApi);

    // Load the template
    if (!this.options.output?.templateRoot) throw new Error("Missing templateRoot in config");
    if (!this.options.output?.outputRoot) throw new Error("Missing outputRoot in config");

    // Check output folder exists
    this.createDir(this.getOutputRoot());

    // Set Metadata
    setMetadataCache(metadataCache);

    // Get the edmx metadata
    const metadataXml = await this.getEdmxMetadata(server);

    const schema = new SchemaGenerator(metadataXml, this.options, (logicalName: string) => {
      return this.getWebApiMetadata(logicalName);
    });
    await schema.generate();
    this.outputEntities(schema);
    this.outputEnums(schema);
    this.outputActions(schema);
    this.outputFunctions(schema);
    this.outputComplexTypes(schema);
    this.outputFiles("metadata.esj", ".", [{ ...schema, ...this.options }], function() {
      return "metadata";
    });
  }

  createDir(dirPath: string): void {
    try {
      fs.mkdirSync(dirPath);
    } catch (ex) {
      if (ex.code != "EEXIST") {
        throw ex;
      }
    }
  }

  async getWebApiMetadata(entity: string): Promise<ComplexEntityMetadata> {
    const projectDir = path.resolve(".");
    let metadataResponse: ComplexEntityMetadata;
    // Check if we have a cached value
    const entityMetadataFile = path.join(projectDir, entity + ".metadata.json");
    if (this.options.output?.useCache && fs.existsSync(entityMetadataFile)) {
      const cachedMetadataJSON = fs.readFileSync(entityMetadataFile).toString();
      metadataResponse = JSON.parse(cachedMetadataJSON) as ComplexEntityMetadata;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const response = await this.getEntityMetadata(entity, this.cdsService);
      if (!response.EntityMetadata) throw new Error("No metadata response");
      metadataResponse = response.EntityMetadata[0];
      if (this.options.output?.useCache) {
        // Save to file cache
        fs.writeFileSync(entityMetadataFile, JSON.stringify(metadataResponse));
      }
    }
    return metadataResponse;
  }
  async getEntityMetadata(
    logicalName: string,
    cdsService: XrmContextCdsServiceClient,
  ): Promise<RetrieveMetadataChangesResponse> {
    console.log(`Fetching CDS metadata for ${logicalName}`);
    const metadataQuery = {
      logicalName: "RetrieveMetadataChanges",
      Query: {
        Criteria: {
          Conditions: [
            {
              PropertyName: "LogicalName",
              ConditionOperator: MetadataConditionOperator.Equals,
              Value: {
                Value: logicalName,
                Type: "System.String",
              },
            },
          ],
          FilterOperator: LogicalOperator.And,
        },
        Properties: {
          PropertyNames: ["Attributes", "SchemaName", "EntitySetName"],
        },
        AttributeQuery: {
          Properties: {
            PropertyNames: [
              "SchemaName",
              "LogicalName",
              "OptionSet",
              "RequiredLevel",
              "AttributeType",
              "AttributeTypeName",
              "SourceType",
              "IsLogical",
              "AttributeOf",
              "Targets",
              "Description",
              "DateTimeBehavior",
              "Format",
              "DisplayName",
            ],
          },
        },
      },
    } as RetrieveMetadataChangesRequest;

    const metadataResponse = (await cdsService.execute(metadataQuery)) as RetrieveMetadataChangesResponse;
    return metadataResponse;
  }

  async getEdmxMetadata(server: string): Promise<string> {
    console.log("Fetching EDMX metadata");
    const edmxCachePath = path.resolve(".") + "\\cds-edmx.xml";
    let edmxString: string;
    if (this.options.output?.useCache && fs.existsSync(edmxCachePath)) {
      edmxString = fs.readFileSync(edmxCachePath).toString();
    } else {
      const accessToken = await getAccessToken(server.replace("https://", ""));
      const metadataUrl = server + "/api/data/v9.0/$metadata";
      const request = new NodeWebApiRequest(accessToken);
      edmxString = (await request.send("GET", metadataUrl)) as string;
      if (this.options.output?.useCache) {
        fs.writeFileSync(edmxCachePath, edmxString);
      }
    }
    return edmxString;
  }

  outputEntities(schema: SchemaGenerator): void {
    this.outputFiles("entity.ejs", "entities", schema.EntityTypes as unknown[], this.schemaNameKey);
  }

  outputEnums(schema: SchemaGenerator): void {
    this.outputFiles("enum.ejs", "enums", schema.EnumTypes as unknown[], this.nameKey);
  }

  outputActions(schema: SchemaGenerator): void {
    this.outputFiles("action.ejs", "actions", schema.Actions as unknown[], this.nameKey);
  }

  outputFunctions(schema: SchemaGenerator): void {
    this.outputFiles("function.ejs", "functions", schema.Functions as unknown[], this.nameKey);
  }

  outputComplexTypes(schema: SchemaGenerator): void {
    this.outputFiles("complextype.ejs", "complextypes", schema.ComplexTypes as unknown[], this.nameKey);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nameKey(item: any): string {
    return item?.Name;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaNameKey(item: any): string {
    return item?.SchemaName;
  }
  getOutputRoot(): string {
    if (this.options.output?.outputRoot) {
      return path.join(this.projectDir, this.options.output?.outputRoot);
    } else {
      throw new Error("outputRoot required");
    }
  }
  outputFiles(
    templateFileName: string,
    outputDir: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemArray: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getFileName: (item: any) => string,
  ): void {
    const outputRoot = this.getOutputRoot();

    // Create output directory
    const enumRootPath = path.join(outputRoot, outputDir);
    this.createDir(enumRootPath);

    // Read template from the current project if it exists
    const projectTemplatePath = path.join(
      this.projectDir,
      this.options.output?.templateRoot as string,
      templateFileName,
    );
    const packageTemplatePath = path.join(this.packageDir, "../_templates", templateFileName);

    let template: string;
    if (fs.existsSync(projectTemplatePath)) {
      template = fs.readFileSync(projectTemplatePath).toString();
    } else {
      template = fs.readFileSync(packageTemplatePath).toString();
    }
    for (const item of itemArray) {
      const fileName = getFileName(item);
      const outFile = path.join(enumRootPath, `${fileName}${this.options.output?.fileSuffix}`);
      let output = "";
      try {
        console.log("Generating: " + outFile);
        output = ejs.render(template, { ...this.options, ...item });
      } catch (ex) {
        output = ex.message;
        console.error(ex.message);
      }
      fs.writeFileSync(outFile, output);
    }
  }
}