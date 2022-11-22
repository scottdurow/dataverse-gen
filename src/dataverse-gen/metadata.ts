/* eslint-disable*/
import { RetrieveMetadataChangesMetadata } from "./functions/RetrieveMetadataChanges";
import { WhoAmIMetadata } from "./functions/WhoAmI";

export const Entities = {
};

// Setup Metadata
// Usage: setMetadataCache(metadataCache);
export const metadataCache = {
  entities: {
  },
  actions: {
    RetrieveMetadataChanges: RetrieveMetadataChangesMetadata,
    WhoAmI: WhoAmIMetadata,
  }
};