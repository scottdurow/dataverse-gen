import config = require("config");
import { NodeXrmConfig } from "dataverse-ify/lib/webapi/config/NodeXrmConfig";
import { DataverseMetadataService } from "../MetadataService";
import * as path from "path";
import * as fs from "fs";

describe("MetadataService", () => {
  const configFile = config.get("nodewebapi") as NodeXrmConfig;
  const projectDir = path.resolve(".");

  it("downloads EMDX", async () => {
    const service = new DataverseMetadataService();
    const server = configFile.server?.host as string;
    await service.authorize(server);
    const edmx = await service.getEdmxMetadata();
    fs.writeFileSync(path.join(projectDir, "src/__tests__/data/edmx.xml"), edmx);
  }, 1000000);

  it("downloads entity metadata", async () => {
    const service = new DataverseMetadataService();
    const server = configFile.server?.host as string;
    await service.authorize(server);
    const metadata = await service.getEntityMetadata("account");
    metadata.ServerVersionStamp = undefined;

    // Save model for unit tests
    fs.writeFileSync(path.join(projectDir, "src/__tests__/data/account-metadata.json"), JSON.stringify(metadata));

    const metadata2 = await service.getEntityMetadata("opportunity");
    metadata2.ServerVersionStamp = undefined;
    fs.writeFileSync(path.join(projectDir, "src/__tests__/data/opportunity-metadata.json"), JSON.stringify(metadata2));

    const metadata3 = await service.getEntityMetadata("opportunityclose");
    metadata3.ServerVersionStamp = undefined;
    fs.writeFileSync(
      path.join(projectDir, "src/__tests__/data/opportunityclose-metadata.json"),
      JSON.stringify(metadata3),
    );
  }, 1000000);
});
