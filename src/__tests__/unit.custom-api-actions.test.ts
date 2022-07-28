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
});
