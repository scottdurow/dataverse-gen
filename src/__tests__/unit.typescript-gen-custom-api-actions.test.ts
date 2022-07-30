/* eslint-disable quotes */
/* eslint-disable sonarjs/no-duplicate-string */
import { generate } from "./helpers";
const defaultOptions = {
  entities: ["cdsify_integrationtest"],
  actions: ["cdsify_UnboundEcho"],
  functions: [],
  output: {
    outputRoot: "./src/dataverse-gen",
  },
};
describe("TypeScriptGenerator", () => {
  it("handles string arrays in custom api actions requests", async () => {
    const files: Record<string, string> = await generate(defaultOptions);
    const file = files["actions\\cdsify_UnboundEcho.ts"];
    expect(file).toBeDefined();
    expect(file).toContain("cdsify_UnboundInStringArray?: string[]");
  });

  it("handles entity columns in custom api actions response", async () => {
    const files: Record<string, string> = await generate(defaultOptions);
    const file = files["complextypes\\cdsify_UnboundEchoResponse.ts"];
    expect(file).toBeDefined();

    expect(file).toMatch(
      'cdsify_UnboundOutEntity?: import("../entities/cdsify_IntegrationTest").cdsify_IntegrationTest;',
    );
    expect(file).toMatch("cdsify_UnboundOutEntityCollection?: any[];");
  });

  it("creates entity bound parameters", async () => {
    const files: Record<string, string> = await generate({
      entities: ["cdsify_integrationtest"],
      actions: ["cdsify_BoundEcho"],
      functions: [],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    });
    const file = files["actions\\cdsify_BoundEcho.ts"];
    expect(file).toBeDefined();
    const lines = file.split("\n");
    expect(lines[7]).toMatch('boundParameter: "entity",');
    expect(lines[10]).toMatch('typeName: "mscrm.cdsify_integrationtest"');
  });

  it("creates enittyset bound parameters", async () => {
    const files: Record<string, string> = await generate({
      entities: ["cdsify_integrationtest"],
      actions: ["cdsify_BoundCollectionEcho"],
      functions: [],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    });
    const file = files["actions\\cdsify_BoundCollectionEcho.ts"];
    expect(file).toBeDefined();
    const lines = file.split("\n");
    expect(lines[7]).toMatch('boundParameter: "entityset",');
    expect(lines[10]).toMatch('typeName: "mscrm.cdsify_integrationtest"');
  });

  it("creates entity bound function parameters", async () => {
    const files: Record<string, string> = await generate({
      entities: ["cdsify_integrationtest"],
      actions: [""],
      functions: ["cdsify_BoundEchoFunction"],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    });
    const file = files["functions\\cdsify_BoundEchoFunction.ts"];
    expect(file).toBeDefined();
    const lines = file.split("\n");
    expect(lines[7]).toMatch('boundParameter: "entity",');
    expect(lines[10]).toMatch('typeName: "mscrm.cdsify_integrationtest"');
  });
});
