/* eslint-disable sonarjs/no-duplicate-string */
import { generateWithModel, getModel } from "./helpers";

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

    const files: Record<string, string> = await generateWithModel(defaultOptions, model);
    const file = files["entities\\cdsify_IntegrationTest.ts"];
    expect(file).toBeDefined();
    // Check that the File attribute is of type string
    // eslint-disable-next-line prettier/prettier
    expect(file).toContain("import { IEntity } from \"../../types/IEntity\";");
  });
});
