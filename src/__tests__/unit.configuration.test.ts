/* eslint-disable sonarjs/no-duplicate-string */
import { MetadataService } from "../MetadataService";
import { SchemaModel } from "../SchemaModel";
import * as fs from "fs";
import * as path from "path";
import { TypescriptGenerator } from "../TypescriptGenerator";
import { CodeWriter } from "../CodeWriter";
import { FileSystemTemplateProvider } from "../TemplateProvider";

describe("TypeScriptGenerator", () => {
  it("allows remapping of imports", async () => {
    const defaultOptions = {
      entities: ["cdsify_integrationtest"],
      actions: [],
      functions: [],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
      referencedTypes: {
        Entity: {
          name: "IEntity",
          import: "../../types/IEntity",
        },
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
    const file = files["entities\\cdsify_IntegrationTest.ts"];
    expect(file).toBeDefined();
    // Check that the File attribute is of type string
    // eslint-disable-next-line prettier/prettier
    expect(file).toContain("import { IEntity } from \"../../types/IEntity\";");
  });
});

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
