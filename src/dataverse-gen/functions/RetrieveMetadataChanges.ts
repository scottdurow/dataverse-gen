/* eslint-disable*/
import { WebApiExecuteRequest } from "dataverse-ify";
import { StructuralProperty } from "dataverse-ify";
import { OperationType } from "dataverse-ify";

// Action RetrieveMetadataChanges
export const RetrieveMetadataChangesMetadata = {
  parameterTypes: {
    "Query": {
      typeName: "mscrm.EntityQueryExpression",
      structuralProperty: StructuralProperty.EntityType
      },		
      "DeletedMetadataFilters": {
      typeName: "mscrm.DeletedMetadataFilters",
      structuralProperty: StructuralProperty.EnumerationType
      },		
      "ClientVersionStamp": {
      typeName: "Edm.String",
      structuralProperty: StructuralProperty.PrimitiveType
      },		
      "AppModuleId": {
      typeName: "Edm.Guid",
      structuralProperty: StructuralProperty.PrimitiveType
      },		
      "RetrieveAllSettings": {
      typeName: "Edm.Boolean",
      structuralProperty: StructuralProperty.PrimitiveType
      },		
  
  },
  operationType: OperationType.Function,
  operationName: "RetrieveMetadataChanges"
};

export interface RetrieveMetadataChangesRequest extends WebApiExecuteRequest {
  Query?: import("../complextypes/EntityQueryExpression").EntityQueryExpression;
  DeletedMetadataFilters?: import("../enums/DeletedMetadataFilters").DeletedMetadataFilters;
  ClientVersionStamp?: string;
  AppModuleId?: import("dataverse-ify").Guid;
  RetrieveAllSettings?: boolean;
}