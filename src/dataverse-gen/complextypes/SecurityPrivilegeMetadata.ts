/* eslint-disable*/
export interface SecurityPrivilegeMetadata {
  PrivilegeType?: import("../enums/PrivilegeType").PrivilegeType;
  PrivilegeId?: import("dataverse-ify").Guid;
  Name?: string;
  CanBeParentEntityReference?: boolean;
  CanBeLocal?: boolean;
  CanBeGlobal?: boolean;
  CanBeEntityReference?: boolean;
  CanBeDeep?: boolean;
  CanBeBasic?: boolean;
}