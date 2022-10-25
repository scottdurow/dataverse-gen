export enum TypeScriptTypes {
  enumType = 0,
  entityType = 1,
  complexType = 2,
  primitive = 3,
}
export interface TypeScriptType {
  name?: string;
  outputType?: TypeScriptTypes;
  importLocation?: string;
  definitelyTypedFieldType?: string;
}
