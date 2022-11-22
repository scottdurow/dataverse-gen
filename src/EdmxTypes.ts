import { TypeScriptType } from "./TypeScriptType";

export interface EdmxBase {
  ReferencedBy: FunctionType[];
  Name: string;
  Properties: EntityTypeProperty[];
  NavigationProperties: EntityTypeNavigationProperty[];
  ReferencedByRoot?: ComplexType[];
}

export interface EntityTypeProperty {
  TypescriptType?: TypeScriptType;
  IsMultiSelect: boolean;
  Name: string;
  Type: string;
  Nullable?: boolean;
  IsRequired?: boolean;
  Format: string;
  DisplayName: string;
  Description: string;
  IsEnum: boolean;
  AttributeOf?: string;
  SourceType?: number;
}

export interface EntityTypeNavigationProperty {
  TypescriptType?: TypeScriptType;
  LogicalName: string;
  FullName: string;
  Type: string;
  Name: string;
  Relationship?: string;
  FromRole?: string;
  ToRole?: string;
  IsCollection?: boolean;
  ReferentialConstraint?: string;
  ReferencedProperty?: string;
  definitelyTypedType?: string;
}

export interface EntityType extends EdmxBase {
  SchemaName?: string;
  OpenType: boolean;
  EntitySetName?: string;
  BaseType: string;
  Abstract?: boolean;
  KeyName?: string;
  Key: Array<{
    PropertyRef: {
      Name: string;
    };
  }>;
}

export interface EntitySet {
  Name: string;
  EntitySetName: string;
  EntityType: string;
  CustomActions: ActionType[];
  CustomFunctions: FunctionType[];
}

export type ComplexType = EdmxBase;

export interface Association {
  Name: string;
  End: Array<{
    Role: string;
    Multiplicity: string;
  }>;
}

export interface EnumType {
  Name: string;
  UnderlyingType?: string;
  Value?: string;
  StringMembers?: boolean;
  Members?: EnumMember[];
  ReferencedBy?: FunctionType[];
  ReferencedByRoot?: ComplexType[];
}
export interface EnumMember {
  Name: string;
  Value: string;
}
export type ActionType = FunctionType;

export interface FunctionParameterType {
  structuralTypeName?: string;
  TypescriptTypes?: TypeScriptType[];
  Name: string;
  Type: string;
}

export interface FunctionType extends EdmxBase {
  Name: string;
  IsBound: boolean;
  BindingParameter: string;
  IsBindable: boolean;
  IsSideEffecting: boolean;
  ReturnType?: string;
  IsCollectionAction: boolean;
  ReturnsCollection: boolean;
  Parameters: FunctionParameterType[];
}
