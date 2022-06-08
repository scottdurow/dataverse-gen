import { DataverseGenOptions, defaultOptions } from "./MetadataGeneratorConfig";
import _merge = require("lodash.merge");
import ejs = require("ejs");
import path = require("path");
import { SchemaModel } from "./SchemaModel";
import { CodeWriter } from "./CodeWriter";
import { TemplateProvider } from "./TemplateProvider";

export class TypescriptGenerator {
  options: DataverseGenOptions;
  model: SchemaModel;
  codeWriter: CodeWriter;
  templateProvider: TemplateProvider;
  constructor(
    model: SchemaModel,
    codeWriter: CodeWriter,
    templateProvider: TemplateProvider,
    options: DataverseGenOptions,
  ) {
    this.model = model;
    this.codeWriter = codeWriter;
    this.templateProvider = templateProvider;
    this.options = _merge(defaultOptions, options) as DataverseGenOptions;
  }

  async generate(): Promise<void> {
    // Load the template
    if (!this.options.output?.templateRoot) throw new Error("Missing templateRoot in config");
    if (!this.options.output?.outputRoot) throw new Error("Missing outputRoot in config");

    this.outputEntities(this.model);
    this.outputEnums(this.model);
    this.outputActions(this.model);
    this.outputFunctions(this.model);
    this.outputComplexTypes(this.model);
    this.outputFiles("metadata.ejs", ".", [{ ...this.model, ...this.options }], function () {
      return "metadata";
    });
  }

  outputEntities(schema: SchemaModel): void {
    this.outputFiles("entity.ejs", "entities", schema.EntityTypes as unknown[], this.schemaNameKey);
  }

  outputEnums(schema: SchemaModel): void {
    this.outputFiles("enum.ejs", "enums", schema.EnumTypes as unknown[], this.nameKey);
  }

  outputActions(schema: SchemaModel): void {
    this.outputFiles("action.ejs", "actions", schema.Actions as unknown[], this.nameKey);
  }

  outputFunctions(schema: SchemaModel): void {
    this.outputFiles("function.ejs", "functions", schema.Functions as unknown[], this.nameKey);
  }

  outputComplexTypes(schema: SchemaModel): void {
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

  outputFiles(
    templateFileName: string,
    outputDir: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemArray: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getFileName: (item: any) => string,
  ): void {
    // Create sub-output directory
    this.codeWriter.createSubFolder(outputDir);

    for (const item of itemArray) {
      const fileName = getFileName(item);
      const outFile = path.join(outputDir, `${fileName}${this.options.output?.fileSuffix}`);
      let output = "";
      try {
        console.log("Generating: " + outFile);
        const template = this.templateProvider.getTemplate(templateFileName);
        if (template) {
          output = ejs.render(template, { ...this.options, ...item });
        } else {
          console.warn(`Skipping - no template found '${templateFileName}'`);
        }
      } catch (ex) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = ex as any;
        output = error.message;
        console.error(error.message);
      }
      this.codeWriter.write(outFile, output);
    }
  }
}
