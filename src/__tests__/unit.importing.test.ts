import { CodeWriter } from "../CodeWriter";
import { FileSystemTemplateProvider } from "../TemplateProvider";
import { TypescriptGenerator } from "../TypescriptGenerator";
import { getModel } from "./unit.typescript-generator.test";

describe("resolveTypeToImportLocation", () => {
  it("imports enums in complex types", async () => {
    const defaultOptions = {
      entities: [],
      actions: ["cdsify_UnboundEcho"],
      functions: ["RetrieveMetadataChanges"],
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
    const file = files["complextypes\\ComplexEntityMetadata.ts"];
    expect(file).toBeDefined();
    expect(file).toMatch(/OwnershipType\?: import\("..\/enums\/OwnershipTypes"\).OwnershipTypes;/);

    // The typing of the entity imports should be consistent - always the schema name
    const unboundEchoResponse = files["complextypes\\cdsify_UnboundEchoResponse.ts"];
    expect(unboundEchoResponse).toBeDefined();
    // This test is case sensitive for a reason!
    expect(unboundEchoResponse).toMatch(
      /cdsify_UnboundOutEntity\?: import\("..\/entities\/cdsify_IntegrationTest"\).cdsify_integrationtest;/,
    );
  });
});
