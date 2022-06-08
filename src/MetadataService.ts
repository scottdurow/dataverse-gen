import { RetrieveMetadataChangesResponse } from "./dataverse-gen/complextypes/RetrieveMetadataChangesResponse";
import { DataverseClient, setMetadataCache, XrmContextDataverseClient } from "dataverse-ify";
import { acquireToken, NodeWebApiRequest, WebApiStatic } from "dataverse-ify/lib/webapi";
import * as fs from "fs";
import path = require("path");
import { RetrieveMetadataChangesRequest } from "./dataverse-gen/functions/RetrieveMetadataChanges";
import { MetadataConditionOperator } from "./dataverse-gen/enums/MetadataConditionOperator";
import { LogicalOperator } from "./dataverse-gen/enums/LogicalOperator";
import { metadataCache } from "./dataverse-gen/metadata";

export interface MetadataService {
  getEntityMetadata(logicalName: string): Promise<RetrieveMetadataChangesResponse>;
  getEdmxMetadata(useCache?: boolean): Promise<string>;
}

export class DataverseMetadataService implements MetadataService {
  client: DataverseClient | undefined;
  server: string | undefined;
  accessToken: string | undefined;
  entityMetadataCache: Record<string, RetrieveMetadataChangesResponse> = {};
  edmx: string | undefined;
  async authorize(server: string) {
    // Clear cache
    this.edmx = undefined;
    this.entityMetadataCache = {};
    this.server = server;
    this.accessToken = await acquireToken(server.replace("https://", ""));
    const nodeWebApi = new WebApiStatic(this.accessToken, server);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.client = new XrmContextDataverseClient(nodeWebApi as any as Xrm.WebApi);
    // Set Metadata
    setMetadataCache(metadataCache);
  }

  async getEntityMetadata(logicalName: string): Promise<RetrieveMetadataChangesResponse> {
    if (this.entityMetadataCache[logicalName]) return this.entityMetadataCache[logicalName];
    if (!this.client) throw "Not initialized";
    console.log(`Fetching Dataverse metadata for ${logicalName}`);
    const metadataQuery = {
      logicalName: "RetrieveMetadataChanges",
      Query: {
        Criteria: {
          Conditions: [
            {
              PropertyName: "LogicalName",
              ConditionOperator: MetadataConditionOperator.Equals,
              Value: {
                Value: logicalName,
                Type: "System.String",
              },
            },
          ],
          FilterOperator: LogicalOperator.And,
        },
        Properties: {
          PropertyNames: ["Attributes", "SchemaName", "EntitySetName"],
        },
        AttributeQuery: {
          Properties: {
            PropertyNames: [
              "SchemaName",
              "LogicalName",
              "OptionSet",
              "RequiredLevel",
              "AttributeType",
              "AttributeTypeName",
              "SourceType",
              "IsLogical",
              "AttributeOf",
              "Targets",
              "Description",
              "DateTimeBehavior",
              "Format",
              "DisplayName",
            ],
          },
        },
      },
    } as RetrieveMetadataChangesRequest;

    const metadataResponse = (await this.client.execute(metadataQuery)) as RetrieveMetadataChangesResponse;

    // Sort properties
    metadataResponse.EntityMetadata?.forEach((m) =>
      m.Attributes?.sort((a, b) => ((a.LogicalName as string) > (b.LogicalName as string) ? 1 : -1)),
    );
    this.entityMetadataCache[logicalName] = metadataResponse;
    return metadataResponse;
  }

  async getEdmxMetadata(useCache?: boolean): Promise<string> {
    if (this.edmx) return this.edmx;
    console.log("Fetching EDMX metadata");
    const edmxCachePath = path.resolve(".") + "\\cds-edmx.xml";
    let edmxString: string;
    if (useCache && fs.existsSync(edmxCachePath)) {
      edmxString = fs.readFileSync(edmxCachePath).toString();
    } else {
      const metadataUrl = this.server + "/api/data/v9.0/$metadata";
      const request = new NodeWebApiRequest(this.accessToken);
      edmxString = (await request.send("GET", metadataUrl)) as string;
      if (useCache) {
        fs.writeFileSync(edmxCachePath, edmxString);
      }
    }
    this.edmx = edmxString;
    return edmxString;
  }
}
