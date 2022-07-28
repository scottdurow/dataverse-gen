/* eslint-disable sonarjs/no-duplicate-string */
import { TypescriptGenerator } from "../TypescriptGenerator";
import { CodeWriter } from "../CodeWriter";
import { TemplateProvider } from "../TemplateProvider";
import { EntityType } from "../EdmxTypes";
import { generateWithModel, getModel } from "./helpers";

describe("TypeScriptGenerator", () => {
  it("generates code", async () => {
    const defaultOptions = {
      entities: ["account", "opportunity"],
      actions: ["WinOpportunity"],
      functions: ["RetrieveMetadataChanges", "WhoAmI"],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    };

    const model = await getModel(defaultOptions);

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
    const codeGenerator = new TypescriptGenerator(model, codeWriter, templateProvider, defaultOptions, jest.fn());
    await codeGenerator.generate();
    expect(codeWriter.write).toBeCalledTimes(95);
  });

  it("handles newlines in attribute description", async () => {
    const defaultOptions = {
      entities: ["account", "opportunity"],
      actions: ["WinOpportunity"],
      functions: ["RetrieveMetadataChanges", "WhoAmI"],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    };
    const model = await getModel(defaultOptions);

    // Add property with multiple lines in description
    const accountEntity = model.EntityTypes.find((a) => a.Name === "account") as EntityType;
    accountEntity.Properties[0].Description = accountEntity.Properties[0].Description + "\nNew line in description";

    const files = await generateWithModel(
      {
        ...defaultOptions,
        ...{ entities: ["account"] },
      },
      model,
    );

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

  it("handles file columns", async () => {
    const defaultOptions = {
      entities: ["cdsify_integrationtest"],
      actions: [],
      functions: [],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    };
    const model = await getModel(defaultOptions);

    const files: Record<string, string> = await generateWithModel(defaultOptions, model);
    const file = files["entities\\cdsify_IntegrationTest.ts"];
    expect(file).toBeDefined();
    // Check that the File attribute is of type string
    expect(file).toContain("cdsify_file1?: string | null;");
  });
});
