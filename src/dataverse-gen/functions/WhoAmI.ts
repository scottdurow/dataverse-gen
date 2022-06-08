/* eslint-disable*/
import { WebApiExecuteRequest } from "dataverse-ify";
import { OperationType } from "dataverse-ify";

// Action WhoAmI
export const WhoAmIMetadata = {
  parameterTypes: {

  },
  operationType: OperationType.Function,
  operationName: "WhoAmI"
};

export interface WhoAmIRequest extends WebApiExecuteRequest {
}