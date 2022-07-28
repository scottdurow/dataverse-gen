import * as fs from "fs";
import * as path from "path";
import { CodeWriter } from "../CodeWriter";
import { DataverseGenOptions } from "../MetadataGeneratorConfig";
import { MetadataService } from "../MetadataService";
import { SchemaModel } from "../SchemaModel";
import { FileSystemTemplateProvider } from "../TemplateProvider";
import { TypescriptGenerator } from "../TypescriptGenerator";
import { ILoggerCallback } from "../Logger";

export async function getModel(options: DataverseGenOptions) {
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

  const model = new SchemaModel(metadataService, options);
  await model.generate();
  return model;
}

export async function generate(options: DataverseGenOptions) {
  const model = await getModel(options);
  return generateWithModel(options, model);
}

export async function generateWithModel(defaultOptions: DataverseGenOptions, model: SchemaModel) {
  const files: Record<string, string> = {};
  const codeWriter = {
    createSubFolder: jest.fn(),
    write: jest.fn().mockImplementation((path, data) => (files[path] = data)),
  } as CodeWriter;

  const templateProvider = new FileSystemTemplateProvider(defaultOptions);
  const codeGenerator = new TypescriptGenerator(model, codeWriter, templateProvider, defaultOptions, NoLogging);
  await codeGenerator.generate();
  return files;
}

export const NoLogging: ILoggerCallback = () => {
  //noop
};
