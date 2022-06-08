import config = require("config");
import { NodeXrmConfig } from "dataverse-ify/lib/webapi/config/NodeXrmConfig";
import { DataverseMetadataService } from "../MetadataService";
import { SchemaModel } from "../SchemaModel";

describe("SchemaModel", () => {
  const configFile = config.get("nodewebapi") as NodeXrmConfig;
  let service: DataverseMetadataService;
  beforeAll(async () => {
    const server = configFile.server?.host as string;
    service = new DataverseMetadataService();
    await service.authorize(server);
    await service.getEdmxMetadata();
  }, 100000);

  it("adds webapi metadata & filters", async () => {
    const model = new SchemaModel(service, {
      entities: ["account", "opportunity"],
      actions: ["WinOpportunity"],
      functions: ["RetrieveMetadataChanges", "WhoAmI"],
      output: {
        outputRoot: "./src/dataverse-gen",
      },
    });
    await model.generate();
  }, 100000);
});
