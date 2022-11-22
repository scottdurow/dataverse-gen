import { generateWithModel, getModel } from "./helpers";

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

    const files: Record<string, string> = await generateWithModel(defaultOptions, model);
    const file = files["complextypes\\ComplexEntityMetadata.ts"];
    expect(file).toBeDefined();
    expect(file).toMatch(/OwnershipType\?: import\("..\/enums\/OwnershipTypes"\).OwnershipTypes;/);

    // The typing of the entity imports should be consistent - always the schema name
    const unboundEchoResponse = files["complextypes\\cdsify_UnboundEchoResponse.ts"];
    expect(unboundEchoResponse).toBeDefined();
    // This test is case sensitive for a reason!
    expect(unboundEchoResponse).toMatch(
      /cdsify_UnboundOutEntity\?: import\("..\/entities\/cdsify_IntegrationTest"\).cdsify_IntegrationTest;/,
    );
  });
});
