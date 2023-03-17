import * as path from "path";
import * as fs from "fs";
import { getAuthorizedMetadataService } from "./helpers";

describe("MetadataService", () => {
  const projectDir = path.resolve(".");

  it("downloads EMDX", async () => {
    const service = await getAuthorizedMetadataService();
    const edmx = await service.getEdmxMetadata();
    expect(edmx).toBeDefined();
    fs.writeFileSync(path.join(projectDir, "src/__tests__/data/edmx.xml"), edmx);
  }, 1000000);

  it("downloads entity metadata", async () => {
    const service = await getAuthorizedMetadataService();
    const metadata = await service.getEntityMetadata("account");
    metadata.ServerVersionStamp = undefined;

    // Save model for unit tests
    fs.writeFileSync(path.join(projectDir, "src/__tests__/data/account-metadata.json"), JSON.stringify(metadata));

    const metadata2 = await service.getEntityMetadata("opportunity");
    metadata2.ServerVersionStamp = undefined;
    fs.writeFileSync(path.join(projectDir, "src/__tests__/data/opportunity-metadata.json"), JSON.stringify(metadata2));

    const metadata3 = await service.getEntityMetadata("opportunityclose");
    expect(metadata3).toBeDefined();
    metadata3.ServerVersionStamp = undefined;
    fs.writeFileSync(
      path.join(projectDir, "src/__tests__/data/opportunityclose-metadata.json"),
      JSON.stringify(metadata3),
    );

    const metadata4 = await service.getEntityMetadata("cdsify_integrationtest");
    metadata4.ServerVersionStamp = undefined;
    fs.writeFileSync(
      path.join(projectDir, "src/__tests__/data/cdsify_integrationtest-metadata.json"),
      JSON.stringify(metadata4),
    );

    const metadata5 = await service.getEntityMetadata("queueitem");
    metadata5.ServerVersionStamp = undefined;
    fs.writeFileSync(path.join(projectDir, "src/__tests__/data/queueitem-metadata.json"), JSON.stringify(metadata5));

    const metadata6 = await service.getEntityMetadata("EntityMetadata");
    metadata6.ServerVersionStamp = undefined;
    fs.writeFileSync(
      path.join(projectDir, "src/__tests__/data/EntityMetadata-metadata.json"),
      JSON.stringify(metadata6),
    );
  }, 1000000);

  it("handles unknown entities", async () => {
    const service = await getAuthorizedMetadataService();
    const entityMetadata = await service.getEntityMetadata("foo");
    expect(entityMetadata.EntityMetadata).toHaveLength(0);
  });
});
