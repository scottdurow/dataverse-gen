import config = require("config");
import { NodeXrmConfig } from "dataverse-ify/lib/webapi/config/NodeXrmConfig";
import { DataverseMetadataService } from "../MetadataService";

describe("MetadataService", () => {
  const configFile = config.get("nodewebapi") as NodeXrmConfig;

  it("downloads EMDX", async () => {
    const service = new DataverseMetadataService();
    const server = configFile.server?.host as string;
    await service.authorize(server);
    const metadata = await service.getEdmxMetadata();

    expect(metadata).toMatchSnapshot();
  }, 1000000);

  it("downloads entity metadata", async () => {
    const service = new DataverseMetadataService();
    const server = configFile.server?.host as string;
    await service.authorize(server);
    const metadata = await service.getEntityMetadata("account");
    metadata.ServerVersionStamp = undefined;
    expect(metadata).toMatchSnapshot();
  }, 1000000);
});
