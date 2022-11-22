import { getModel } from "./helpers";
describe("SchemaModel", () => {
  it("sets boundParameter type for Entity actions", async () => {
    const model = await getModel({
      entities: ["cdsify_integrationtest"],
      actions: ["cdsify_BoundCollectionEcho"],
      functions: [],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    });
    expect(model.Actions).toHaveLength(1);

    // Check that the entityset parameter is of the correct type
    expect(model.Actions[0].Parameters[0]).toMatchObject({
      Name: "entityset",
      structuralTypeName: "Collection",
      Type: "mscrm.cdsify_integrationtest",
    });
  });

  it("sets boundParameter type for Entity actions", async () => {
    const model = await getModel({
      entities: ["cdsify_integrationtest"],
      actions: ["cdsify_BoundEcho"],
      functions: [],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    });
    expect(model.Actions).toHaveLength(1);

    // Check that the entityset parameter is of the correct type
    expect(model.Actions[0].Parameters[0]).toMatchObject({
      Name: "entity",
      structuralTypeName: "EntityType",
      Type: "mscrm.cdsify_integrationtest",
    });
  });
});
