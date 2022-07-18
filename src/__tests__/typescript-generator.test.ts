//import { SchemaGenerator } from "../SchemaGenerator";

import { MetadataService } from "../MetadataService";
import { SchemaModel } from "../SchemaModel";
import * as fs from "fs";
import * as path from "path";
import { TypescriptGenerator } from "../TypescriptGenerator";
import { CodeWriter } from "../CodeWriter";
import { FileSystemTemplateProvider, TemplateProvider } from "../TemplateProvider";
import { EntityType } from "../EdmxTypes";

describe("TypeScriptGenerator", () => {
  let model: SchemaModel;
  let metadataService: MetadataService;
  const options = {
    entities: ["account", "opportunity"],
    actions: ["WinOpportunity"],
    functions: ["RetrieveMetadataChanges", "WhoAmI"],
    output: {
      outputRoot: "./src/dataverse-gen",
    },
  };
  beforeAll(async () => {
    const projectDir = path.resolve(".");
    const edmx = fs.readFileSync(path.join(projectDir, "src/__tests__/data/edmx.xml")).toString();
    metadataService = {
      getEdmxMetadata: jest.fn().mockReturnValue(edmx),
      getEntityMetadata: jest.fn().mockImplementation((logicalName) => {
        return JSON.parse(
          fs.readFileSync(path.join(projectDir, `src/__tests__/data/${logicalName}-metadata.json`)).toString(),
        );
      }),
    } as MetadataService;

    model = new SchemaModel(metadataService, options);
    await model.generate();
  });

  it("generates code", async () => {
    const codeWriter = {
      createSubFolder: jest.fn(),
      write: jest.fn(),
    } as CodeWriter;
    const templateProvider = {
      getTemplate: jest.fn().mockImplementation((templateName) => {
        // eslint-disable-next-line sonarjs/no-small-switch
        switch (templateName) {
          case "metadata.ejs":
            return "// Metadata Cache";
          default:
            return "<%-Name%>";
        }
      }),
    } as TemplateProvider;
    const codeGenerator = new TypescriptGenerator(model, codeWriter, templateProvider, options);
    await codeGenerator.generate();
  });

  it("handles newlines in attribute description", async () => {
    const files: Record<string, string> = {};
    const codeWriter = {
      createSubFolder: jest.fn(),
      write: jest.fn().mockImplementation((path, data) => (files[path] = data)),
    } as CodeWriter;
    const templateProvider = new FileSystemTemplateProvider(options);
    const codeGenerator = new TypescriptGenerator(model, codeWriter, templateProvider, {
      ...options,
      ...{ entities: ["account"] },
    });
    // Add property with multiple lines in description
    const accountEntity = model.EntityTypes.find((a) => a.Name === "account") as EntityType;
    accountEntity.Properties[0].Description = accountEntity.Properties[0].Description + "\nNew line in description";
    await codeGenerator.generate();
    expect(codeWriter.write).toBeCalledTimes(95);
    const accountFile = files["entities\\Account.ts"];
    // Check the new line is wrapped in /* and */
    const lines = accountFile.split("\n");
    const descLinePos = lines.findIndex((a) => a.indexOf("New line in description") > -1);
    // Ensure the line before and after are comment blocks
    expect(lines[descLinePos - 2]).toContain("/*");
    expect(lines[descLinePos + 1]).toContain("*/");
  });

  it.todo("does not output Target on WhoAmI request");

  it.todo("filters based on publisher prefix");

  it.todo("handles file/image columns");
});