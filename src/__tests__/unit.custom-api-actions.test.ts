/* eslint-disable quotes */
/* eslint-disable sonarjs/no-duplicate-string */
import { MetadataService } from "../MetadataService";
import { SchemaModel } from "../SchemaModel";
import * as fs from "fs";
import * as path from "path";
import { TypescriptGenerator } from "../TypescriptGenerator";
import { CodeWriter } from "../CodeWriter";
import { FileSystemTemplateProvider } from "../TemplateProvider";

describe("TypeScriptGenerator", () => {
  it("handles string arrays in custom api actions requests", async () => {
    const files: Record<string, string> = await generate();
    const file = files["actions\\cdsify_UnboundEcho.ts"];
    expect(file).toBeDefined();
    expect(file).toContain("cdsify_UnboundInStringArray?: string[]");
  });

  it("handles entity columns in custom api actions response", async () => {
    const files: Record<string, string> = await generate();
    const file = files["complextypes\\cdsify_UnboundEchoResponse.ts"];
    expect(file).toBeDefined();

    expect(file).toMatch(
      'cdsify_UnboundOutEntity?: import("../entities/cdsify_integrationtest").cdsify_integrationtest;',
    );
    expect(file).toMatch("cdsify_UnboundOutEntityCollection?: any[];");
  });
});

async function generate() {
  const defaultOptions = {
    entities: ["cdsify_integrationtest"],
    actions: ["cdsify_UnboundEcho"],
    functions: [],
    output: {
      outputRoot: "./src/dataverse-gen",
    },
  };
  const model = await getModel(defaultOptions);

  const files: Record<string, string> = {};
  const codeWriter = {
    createSubFolder: jest.fn(),
    write: jest.fn().mockImplementation((path, data) => (files[path] = data)),
  } as CodeWriter;

  const templateProvider = new FileSystemTemplateProvider(defaultOptions);
  const codeGenerator = new TypescriptGenerator(model, codeWriter, templateProvider, defaultOptions);
  await codeGenerator.generate();
  return files;
}

async function getModel(defaultOptions: {
  entities: string[];
  actions: string[];
  functions: string[];
  output: { outputRoot: string };
}) {
  const projectDir = path.resolve(".");
  const edmx = fs.readFileSync(path.join(projectDir, "src/__tests__/data/edmx.xml")).toString();
  const metadataService = {
    getEdmxMetadata: jest.fn().mockReturnValue(edmx),
    getEntityMetadata: jest.fn().mockImplementation((logicalName) => {
      return JSON.parse(
        fs.readFileSync(path.join(projectDir, `src/__tests__/data/${logicalName}-metadata.json`)).toString(),
      );
    }),
  } as MetadataService;

  const model = new SchemaModel(metadataService, defaultOptions);
  await model.generate();
  return model;
}
