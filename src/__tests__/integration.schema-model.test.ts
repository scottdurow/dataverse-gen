import { getServerConfig } from "dataverse-ify/lib/webapi/node";
import { DataverseMetadataService } from "../MetadataService";
import { SchemaModel } from "../SchemaModel";
import { NoLogging } from "./helpers";

describe("SchemaModel", () => {
  const config = getServerConfig();
  let service: DataverseMetadataService;
  beforeAll(async () => {
    const server = config.host as string;
    service = new DataverseMetadataService(NoLogging);
    await service.authorize(server);
    await service.getEdmxMetadata();
  }, 100000);

  it("adds webapi metadata & filters", async () => {
    const model = new SchemaModel(service, {
      entities: ["account", "opportunity", "cdsify_integrationtest", "queueitem"],
      actions: ["WinOpportunity"],
      functions: ["RetrieveMetadataChanges", "WhoAmI"],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    });
    await model.generate();
    expect(model.EntityTypes.length).toBe(5);
    expect(model.Actions.length).toBe(1);
    expect(model.Functions.length).toBe(2);
    expect(model.EnumTypes.length).toBe(65);
  }, 100000);
});
