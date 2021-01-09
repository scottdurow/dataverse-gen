/* eslint-disable*/
import { WebApiExecuteRequest } from "cdsify";
import { StructuralProperty } from "cdsify";
import { OperationType } from "cdsify";

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
  AppModuleId?: import("cdsify").Guid;
  RetrieveAllSettings?: boolean;
}