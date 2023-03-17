import { RetrieveMetadataChangesResponse } from "./dataverse-gen/complextypes/RetrieveMetadataChangesResponse";
import { DataverseClient, setMetadataCache, XrmContextDataverseClient } from "dataverse-ify";
import { NodeWebApi } from "dataverse-ify/lib/webapi/node";
import * as fs from "fs";
import path = require("path");
import { RetrieveMetadataChangesRequest } from "./dataverse-gen/functions/RetrieveMetadataChanges";
import { MetadataConditionOperator } from "./dataverse-gen/enums/MetadataConditionOperator";
import { LogicalOperator } from "./dataverse-gen/enums/LogicalOperator";
import { metadataCache } from "./dataverse-gen/metadata";
import { DefaultLogger, ILoggerCallback } from "./Logger";

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
  webApi?: NodeWebApi;
  logger: ILoggerCallback;

  constructor(logger?: ILoggerCallback) {
    this.logger = logger || DefaultLogger;
  }

  async authorize(server: string, tenant?: string, appid?: string, secret?: string) {
    // Clear cache
    this.edmx = undefined;
    this.entityMetadataCache = {};
    this.server = server;
    this.webApi = new NodeWebApi(server);
    if (appid && tenant && secret) {
      await this.webApi.authorizeWithSecret(tenant, appid, secret);
    } else {
      await this.webApi.authorize();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.client = new XrmContextDataverseClient(this.webApi as any as Xrm.WebApi);
    // Set Metadata
    setMetadataCache(metadataCache);
  }

  async getEntityMetadata(logicalName: string): Promise<RetrieveMetadataChangesResponse> {
    if (this.entityMetadataCache[logicalName]) return this.entityMetadataCache[logicalName];
    if (!this.client) throw new Error("Not initialized");
    this.logger(`Fetching Dataverse metadata for ${logicalName}`);
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
    this.logger("Fetching EDMX metadata");
    const edmxCachePath = path.resolve(".") + "\\cds-edmx.xml";
    let edmxString: string;
    if (useCache && fs.existsSync(edmxCachePath)) {
      edmxString = fs.readFileSync(edmxCachePath).toString();
    } else {
      const metadataUrl = this.server + "/api/data/v9.0/$metadata";
      if (this.webApi) {
        const request = this.webApi.requestImplementation;
        edmxString = (await request.send("GET", metadataUrl, {})).body as string;
      } else {
        throw new Error("webapi authorize not called");
      }
      if (useCache) {
        fs.writeFileSync(edmxCachePath, edmxString);
      }
    }
    this.edmx = edmxString;
    return edmxString;
  }
}
