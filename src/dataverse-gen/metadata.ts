/* eslint-disable*/
import { RetrieveMetadataChangesMetadata } from "./functions/RetrieveMetadataChanges";

export const Entities = {
};

// Setup Metadata
// Usage: setMetadataCache(metadataCache);
export const metadataCache = {
  entities: {
  },
  actions: {
    RetrieveMetadataChanges: RetrieveMetadataChangesMetadata,
  }
};