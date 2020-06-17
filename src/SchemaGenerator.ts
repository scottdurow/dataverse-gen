import * as convert from "xml-js";
import {
  EntityType,
  EntitySet,
  ComplexType,
  Association,
  EnumType,
  EntityTypeProperty,
  EntityTypeNavigationProperty,
  ActionType,
  FunctionType,
  FunctionParameterType,
  EnumMember,
} from "./EdmxTypes";
import { Dictionary, StructuralProperty } from "cdsify";
import { TypeScriptType, TypeScriptTypes } from "./TypeScriptType";
import { CdsifyOptions } from "./MetadataGeneratorConfig";
import { ComplexEntityMetadata } from "./cds-generated/complextypes/ComplexEntityMetadata";
import { AttributeRequiredLevel } from "./cds-generated/enums/AttributeRequiredLevel";

export class SchemaGenerator {
  options: CdsifyOptions = {};
  EntityTypes: EntityType[] = [];
  EntitySet: EntitySet[] = [];
  ComplexTypes: ComplexType[] = [];
  Association: Association[] = [];
  EnumTypes: EnumType[] = [];
  Functions: FunctionType[] = [];
  Actions: ActionType[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata!: { [key: string]: any };
  _entityTypeIndex: Dictionary<EntityType> = {};
  _enums: Dictionary<EnumType> = {};
  _loadWebApiMetadata?: (logicalName: string) => Promise<ComplexEntityMetadata>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _metadataJson: any;
  constructor(
    schemaXml: string,
    options: CdsifyOptions = {},
    loadWebApiMetadata?: (logicalName: string) => Promise<ComplexEntityMetadata>,
  ) {
    this.options = options;
    this._loadWebApiMetadata = loadWebApiMetadata;
    const metadataJsonString = convert.xml2json(schemaXml, { compact: true, spaces: 4 });
    this._metadataJson = JSON.parse(metadataJsonString);
    this.Metadata = this._metadataJson["edmx:Edmx"]["edmx:DataServices"].Schema;
  }

  async generate(): Promise<void> {
    this.readEnums();
    this.readEntityTypes();
    this.readEntitySets();
    this.setEntitySetName();
    this.readComplexTypes();
    this.readActions();
    this.readFunctions();
    this.filter();
    await this.addEntityMetadata();
    this.updateMappedComplexTypeNames();
    this.setTypeScriptTypes();
  }

  private setTypeScriptTypes(): void {
    for (const item of this.ComplexTypes) {
      for (const param of item.Properties) {
        param.TypescriptType = this.getTypeScriptType(param);
      }
    }
    for (const item of this.Actions) {
      for (const param of item.Properties) {
        param.TypescriptType = this.getTypeScriptType(param);
      }
      for (const param of item.Parameters) {
        param.TypescriptTypes = this.getParameterTypeScriptType(param);
      }
    }
    for (const item of this.Functions) {
      for (const param of item.Properties) {
        param.TypescriptType = this.getTypeScriptType(param);
      }
      for (const param of item.Parameters) {
        param.TypescriptTypes = this.getParameterTypeScriptType(param);
      }
    }
    for (const item of this.EntityTypes) {
      for (const property of item.Properties) {
        property.TypescriptType = this.getTypeScriptType(property);
      }
    }
  }

  updateMappedComplexTypeNames(): void {
    // Check if we are mapping any names to alternatives
    // Eg. Special case for mscrm.Object => ObjectValue
    for (const complexType of this.ComplexTypes) {
      complexType.Name = this.mapTypeName(complexType.Name);
    }
  }

  mapTypeName(typeName: string): string {
    const mapping = this.options.referencedTypes && this.options.referencedTypes[typeName];
    if (mapping && mapping.name) {
      return mapping.name;
    }
    return typeName;
  }

  async addEntityMetadata(): Promise<void> {
    for (const entity of this.EntityTypes) {
      if (!this._loadWebApiMetadata) throw new Error("loadWebApiMetadata callback not set");
      const entityMetadata = await this._loadWebApiMetadata(entity.Name);
      if (!entityMetadata.LogicalName) continue;
      const entityType = this._entityTypeIndex[entityMetadata.LogicalName];

      // Set the additional properties that are not available in the edmx
      entityType.SchemaName = entityMetadata.SchemaName;
      entityType.EntitySetName = entityMetadata.EntitySetName;

      // Re-add the properties with all the information required (not in the emdx)
      entityType.Properties = [];
      if (!entityMetadata.Attributes) continue;

      for (const attribute of entityMetadata.Attributes.filter(
        a => a.AttributeTypeName?.Value != "VirtualType",
      ).sort((a, b) => (a < b ? -1 : 1))) {
        // If the attribute is a PickList or Status Type then add the enum
        const attributeType = attribute.AttributeTypeName?.Value;
        let typeName = attribute.AttributeTypeName?.Value;
        let dateFormat = "";
        let mutliSelect = false;
        let optionSetEnum: EnumType | undefined = undefined;
        switch (attributeType) {
          case "DateTimeType":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dateField = attribute as any;
            dateFormat = dateField.Format.toString() + ":" + dateField.DateTimeBehavior?.Value;
            break;
          case "CustomerType":
          case "LookupType":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lookup = attribute as any;

            if (lookup.Targets.length > 0) {
              const relatedNav = entityType.NavigationProperties.filter(a =>
                a.Name.startsWith(attribute.LogicalName + "_"),
              );
              if (relatedNav && relatedNav.length > 0) {
                const firstNav = relatedNav[0];
                firstNav.Type = (lookup.Targets as string[]).join(",");
                firstNav.FullName = attribute.LogicalName as string;
                firstNav.Name = this.getNavigationName(firstNav.FullName);

                // Remove all the but the grouped navigation property
                for (const nav of relatedNav) {
                  const index = entityType.NavigationProperties.indexOf(nav, 0);
                  if (index > -1) {
                    entityType.NavigationProperties.splice(index, 1);
                  }
                }
                entityType.NavigationProperties.push(firstNav);
              }
            }
            break;
          case "PicklistType":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const optionSet = attribute as any;
            optionSetEnum = this.addEnum(optionSet.OptionSet, entityMetadata);
            break;
          case "MultiSelectPicklistType":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const multiOptionSet = attribute as any;
            optionSetEnum = this.addEnum(multiOptionSet.OptionSet, entityMetadata);
            mutliSelect = true;
            break;
          case "StatusType":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const statusOptions = attribute as any;
            optionSetEnum = this.addEnum(statusOptions.OptionSet, entityMetadata);
            break;
          case "StateType":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stateOptions = attribute as any;
            optionSetEnum = this.addEnum(stateOptions.OptionSet, entityMetadata);
            break;
        }
        if (optionSetEnum) {
          typeName = optionSetEnum.Name;
        }
        const property = {
          Type: typeName,
          Name: attribute.LogicalName,
          SchemaName: attribute.SchemaName,
          IsRequired: attribute.RequiredLevel?.Value == AttributeRequiredLevel.ApplicationRequired,
          IsEnum: optionSetEnum != undefined,
          Description: attribute.Description?.UserLocalizedLabel ? attribute.Description.UserLocalizedLabel.Label : "",
          DisplayName: attribute.DisplayName?.UserLocalizedLabel ? attribute.DisplayName.UserLocalizedLabel.Label : "",
          Format: dateFormat,
          IsMultiSelect: mutliSelect,
        } as EntityTypeProperty;
        entityType.Properties.push(property);
      }
    }
  }
  getParameterTypeScriptType(param: FunctionParameterType): TypeScriptType[] | undefined {
    let typeName: string;
    let outputType: TypeScriptTypes = TypeScriptTypes.primitive;
    let structuralType = this.getStructuralType(param);
    switch (param.Type) {
      case "Edm.Guid":
        typeName = "Guid";
        break;
      case "Edm.String":
      case "Edm.Duration":
      case "Edm.Binary":
        typeName = "string";
        break;
      case "Edm.Int16":
      case "Edm.Int32":
      case "Edm.Int64":
      case "Edm.Double":
      case "Edm.Decimal":
        typeName = "number";
        break;
      case "Edm.Boolean":
        typeName = "boolean";
        break;
      case "Edm.DateTimeOffset":
        typeName = "Date";
        break;
      default: {
        typeName = this.lastValue(param.Type.split("."));
        typeName = this.trimEnd(typeName, ")");
        if (typeName == "crmbaseentity") {
          typeName = "any";
          break;
        } else {
          // If complex type - it could still be an entity
          if (
            structuralType == StructuralProperty.ComplexType &&
            this.EntityTypes.find(a => a.Name.toLowerCase() == typeName.toLowerCase())
          ) {
            structuralType = StructuralProperty.EntityType;
          }
          switch (structuralType) {
            case StructuralProperty.EntityType:
              outputType = TypeScriptTypes.entityType;
              typeName = "EntityReference|" + this.resolveToEntityType(typeName);
              break;
            case StructuralProperty.Collection:
              outputType = TypeScriptTypes.entityType;
              typeName = "EntityReference[]|" + this.resolveToEntityType(typeName) + "[]";
              break;
            case StructuralProperty.EnumerationType:
              outputType = TypeScriptTypes.enumType;
              typeName = this.resolveToEnumType(typeName) as string;
              break;
            default:
              outputType = TypeScriptTypes.complexType;
              typeName = this.resolveToComplexType(typeName);
              break;
          }
        }
        break;
      }
    }

    const outputTypes: TypeScriptType[] = [];
    for (const item of typeName.split("|")) {
      const typeItem = {
        name: item,
        outputType: outputType,
        importLocation: this.resolveTypeToImportLocation(item, outputType),
      } as TypeScriptType;
      outputTypes.push(typeItem);
      param.structuralTypeName = this.structuralPropertyToString(structuralType);
    }
    return outputTypes;
  }

  structuralPropertyToString(value: StructuralProperty): string {
    switch (value) {
      case StructuralProperty.Collection:
        return "Collection";
      case StructuralProperty.Unknown:
        return "Unknown";
      case StructuralProperty.PrimitiveType:
        return "PrimitiveType";
      case StructuralProperty.EnumerationType:
        return "EnumerationType";
      case StructuralProperty.ComplexType:
      case StructuralProperty.EntityType:
        return "EntityType";
      case StructuralProperty.PrimitiveType:
        return "PrimitiveType";
    }
    return "PrimitiveType";
  }

  resolveTypeToImportLocation(typeName: string, outputType: TypeScriptTypes): string | undefined {
    // Is there a mapping direct map
    const typeNameImport = typeName.replace("[]", "");
    if (this.options.referencedTypes && this.options.referencedTypes[typeNameImport]) {
      return this.options.referencedTypes[typeNameImport].import;
    }
    if (this.options.referencedTypes) {
      switch (outputType) {
        case TypeScriptTypes.enumType:
          return this.options.referencedTypes["enums"].import + typeNameImport;
        case TypeScriptTypes.entityType:
          return this.options.referencedTypes["entityTypes"].import + typeNameImport;
        case TypeScriptTypes.complexType:
          return this.options.referencedTypes["complexTypes"].import + typeNameImport;
      }
    }
    return undefined;
  }

  resolveToEntityType(logicalName: string): string | undefined {
    // Since the schema names are used for entity types, we must find the schema name
    const entity = this.EntityTypes.find(e => e.Name.toLowerCase() == logicalName.toLowerCase());
    if (entity) return entity.SchemaName;
    else {
      return undefined;
    }
  }

  resolveToComplexType(logicalName: string): string {
    const complexType = this.ComplexTypes.find(e => e.Name == logicalName);
    if (complexType) return complexType.Name;
    else {
      return logicalName;
    }
  }

  resolveToEnumType(logicalName: string): string | undefined {
    const enumType = this.EnumTypes.find(e => e.Name == logicalName);
    if (enumType != null) return enumType.Name;
    else {
      return undefined;
    }
  }

  getStructuralType(param: FunctionParameterType): StructuralProperty {
    if (this.isCollection(param.Type)) {
      return StructuralProperty.Collection;
    }
    const typeName = this.lastValue(param.Type.split("."));
    if (param.Type.startsWith("mscrm")) {
      // Is the type an entity or complex type
      if (this.isCollection(param.Type)) {
        return StructuralProperty.Collection;
      } else if (this.resolveToEntityType(typeName) != null) return StructuralProperty.EntityType;
      else if (this.resolveToEnumType(typeName) != null) return StructuralProperty.EnumerationType;
      else if (this.resolveToComplexType(typeName) != null) return StructuralProperty.ComplexType; // TODO: this seems to be needed to be EntityType otherwise getMetadata is called
    }
    if (param.Type.startsWith("Edm")) {
      return StructuralProperty.PrimitiveType;
    }
    return StructuralProperty.ComplexType;
  }

  trimEnd(value: string, char: string): string {
    if (value.endsWith(char)) {
      value = value.substr(0, value.length - char.length);
    }
    return value;
  }

  getTypeScriptType(property: EntityTypeProperty): TypeScriptType {
    const referencedType = property.Type;
    const isMultiSelect = property.IsMultiSelect;
    const isCollection = this.isCollection(referencedType);
    const typeName = this.removeCollection(referencedType);
    let type = "any";
    /*
      BigIntType
      BooleanType
      CalendarRulesType
      CustomerType
      DateTimeType
      DecimalType
      DoubleType
      EntityNameType
      ImageType
      IntegerType
      LookupType
      ManagedPropertyType
      MemoType
      MoneyType
      MultiSelectPicklistType
      OwnerType
      PartyListType
      PicklistType
      StateType
      StatusType
      StringType
      UniqueidentifierType
      VirtualType
    */

    switch (typeName) {
      case "MultiSelectPicklistType":
        type = "number[]";
        break;
      case "PicklistType":
      case "StateType":
      case "StatusType":
        type = "number";
        break;
      case "Edm.Guid":
      case "UniqueidentifierType":
        type = "Guid";
        break;
      case "ImageType":
      case "Edm.String":
      case "StringType":
      case "Edm.Duration":
      case "Edm.Binary":
      case "MemoType":
      case "EntityNameType":
        type = "string";
        break;
      case "Edm.Int16":
      case "Edm.Int32":
      case "BigIntType":
      case "IntegerType":
      case "Edm.Int64":
      case "Edm.Double":
      case "DoubleType":
      case "Edm.Decimal":
      case "DecimalType":
      case "MoneyType":
        type = "number";
        break;
      case "Edm.Boolean":
      case "BooleanType":
        type = "boolean";
        break;
      case "Edm.DateTimeOffset":
      case "DateTimeType":
        type = "Date";
        break;
      case "CustomerType":
      case "LookupType":
      case "OwnerType":
        type = "EntityReference";
        break;
      case "PartyListType":
        type = "ActivityParty[]";
        break;
      case "ManagedPropertyType":
        type = "number";
        break;
      default:
        {
          type = typeName.indexOf(".") > -1 ? this.lastValue(typeName.split(".").filter(a => a && a != "")) : typeName;
        }
        break;
    }

    // Check if it is an enum
    const enumType = this.EnumTypes.find(e => e.Name == type);
    if (enumType) {
      property.IsEnum = true;
    }
    // E.g. Special case because we don't want an interface called 'Object'
    type = this.mapTypeName(type);
    let outputType = property.IsEnum ? TypeScriptTypes.enumType : TypeScriptTypes.primitive;
    // Check if it is an entity type
    const entityType = this.EntityTypes.find(e => e.SchemaName == type);
    if (entityType) {
      outputType = TypeScriptTypes.entityType;
    }
    const complexType = this.ComplexTypes.find(e => e.Name == type);
    if (complexType) {
      outputType = TypeScriptTypes.complexType;
    }
    // Add array
    if (isCollection || isMultiSelect) {
      type = type + "[]";
    }
    const mappedType = {
      name: type,
      outputType: outputType,
      importLocation: this.resolveTypeToImportLocation(type, outputType),
    } as TypeScriptType;
    return mappedType;
  }

  lastValue<T>(arrayValue: T[]): T {
    return arrayValue[arrayValue.length - 1];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEnum(options: any, entity: ComplexEntityMetadata): EnumType {
    const optionSetEnum = {
      Name: options.Name,
      Members: [],
    } as EnumType;
    for (const option of options.Options) {
      const label = option.Label.UserLocalizedLabel?.Label;
      let name = "_" + option.Value.toString();
      if (label != null && label.length > 0) {
        name = this.makeCodeSafe(option.Label.UserLocalizedLabel.Label);
      }
      optionSetEnum.Members && optionSetEnum.Members.push({ Name: name, Value: option.Value.toString() });
    }
    let addEnum = true;
    // If this is not a global optionset then prefix with the attribute logical name
    if (options.IsGlobal != true) {
      optionSetEnum.Name = entity.LogicalName + "_" + optionSetEnum.Name;
    }
    // Check if the global optionset hasn't been added already
    else {
      if (!this._enums[optionSetEnum.Name]) {
        this._enums[optionSetEnum.Name] = optionSetEnum;
      } else {
        addEnum = false;
      }
    }
    if (addEnum) {
      this.EnumTypes.push(optionSetEnum);
    }
    return optionSetEnum;
  }

  filter(): void {
    // Build index of types
    const entityTypeIndex: Dictionary<EntityType> = {};
    for (const entity of this.EntityTypes) {
      entityTypeIndex[entity.Name] = entity;
    }

    const complexTypeIndex: Dictionary<ComplexType> = {};
    for (const complexType of this.ComplexTypes) {
      complexTypeIndex[complexType.Name] = complexType;
    }

    const enumTypeIndex: Dictionary<EnumType> = {};
    for (const enumType of this.EnumTypes) {
      enumTypeIndex[enumType.Name] = enumType;
    }

    // Determine entities are needed for actions
    let filteredActions: ActionType[] = [];
    if (this.options.actions) {
      filteredActions = this.Actions.filter(a => this.options.actions?.find(f => a.Name == f));
    }

    let filteredFunctions: FunctionType[] = [];
    if (this.options.functions) {
      filteredFunctions = this.Functions.filter(a => this.options.functions?.find(f => a.Name == f));
    }

    for (const action of filteredActions.concat(filteredFunctions)) {
      for (const prop of action.Parameters) {
        // Add reference to entities/complex types
        const typeNameParts = prop.Type.split(".");
        const typeName = typeNameParts[typeNameParts.length - 1];
        if (complexTypeIndex[typeName]) {
          complexTypeIndex[typeName].ReferencedBy.push(action);
        } else if (entityTypeIndex[typeName]) {
          entityTypeIndex[typeName].ReferencedBy.push(action);
        } else if (enumTypeIndex[typeName]) {
          enumTypeIndex[typeName].ReferencedBy?.push(action);
        }
      }

      // Return type reference
      if (action.ReturnType) {
        const typeNameParts = action.ReturnType.split(".");
        const typeName = typeNameParts[typeNameParts.length - 1];
        if (complexTypeIndex[typeName]) {
          complexTypeIndex[typeName].ReferencedBy.push(action);
        } else if (entityTypeIndex[typeName]) {
          entityTypeIndex[typeName].ReferencedBy.push(action);
        } else if (enumTypeIndex[typeName]) {
          enumTypeIndex[typeName].ReferencedBy?.push(action);
        }
      }
    }

    // Determine the complex types that reference other complex types
    // Start with the complex types referenced by the actions or functions
    for (const complexType of this.ComplexTypes.filter(a => a.ReferencedBy.length > 0)) {
      this.addComplexTypeReferences(complexType);
    }

    // Remove all the entities that are not used and not included in the filter
    const filteredEntities = this.options.entities
      ? this.EntityTypes.filter(e => this.options.entities && this.options.entities.indexOf(e.Name) > -1)
      : this.EntityTypes;

    this.EntityTypes = this.EntityTypes.filter(e => e.ReferencedBy.length > 0 || filteredEntities.indexOf(e) > -1);

    // Remove actions not included in the filter
    this.Actions = this.Actions.filter(e => filteredActions.indexOf(e) > -1);

    // Remove the functions not included in the filter
    this.Functions = this.Functions.filter(e => filteredFunctions.indexOf(e) > -1);

    // Remove Complex types that are not referenced by actions or functions
    this.ComplexTypes = this.ComplexTypes.filter(
      t => t.ReferencedBy.length > 0 || (t.ReferencedByRoot && t.ReferencedByRoot.length > 0),
    );

    // Remove Enums that are not referenced by complex types, actions or functions
    this.EnumTypes = this.EnumTypes.filter(
      t => (t.ReferencedByRoot && t.ReferencedByRoot.length > 0) || (t.ReferencedBy && t.ReferencedBy.length > 0),
    );
  }

  makeCodeSafe(name: string): string {
    // Strip non alphanumeric
    name = name.replace(/[^\w]/gm, "");
    // If starts with underscore - strip
    if (name.startsWith("_") && name.length > 1) {
      name = name.substr(1);
    }
    if (this.isNumeric(name.substr(0, 1))) {
      name = `_${name}`;
    }

    return name;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isNumeric(s: any): boolean {
    return !isNaN(s - parseFloat(s));
  }

  getReferencedType(fullType: string): string {
    if (this.isCollection(fullType)) {
      return this.removeCollection(fullType) as string;
    } else return fullType;
  }

  getShortType(fullType: string): string {
    const parts = this.getReferencedType(fullType).split(".");
    if (parts && parts.length > 0) {
      return parts[parts.length - 1];
    }
    return "";
  }

  addComplexTypeReferences(complexType: ComplexType): void {
    for (const property of complexType.Properties) {
      const shortType = this.getShortType(property.Type);
      // If the type is a complex type then add the reference
      const matchingType: ComplexType = this.ComplexTypes.find(c => c.Name == shortType) as ComplexType;
      const matchingEnum: EnumType = this.EnumTypes.find(e => e.Name == shortType) as EnumType;
      if (matchingType) {
        if (!matchingType.ReferencedByRoot) matchingType.ReferencedByRoot = [];
        if (matchingType.ReferencedByRoot.indexOf(complexType) == -1) {
          matchingType.ReferencedByRoot.push(complexType);
          this.addComplexTypeReferences(matchingType);
        }
      } else if (matchingEnum) {
        if (matchingEnum.ReferencedByRoot?.indexOf(complexType) == -1) {
          matchingEnum.ReferencedByRoot?.push(complexType);
        }
      }
    }
  }

  setEntitySetName(): void {
    // Remove System Entities
    const systemEntities = ["crmbaseentity", "principal", "crmmodelbaseentity", "expando"];
    this.EntityTypes = this.EntityTypes.filter(a => systemEntities.indexOf(a.Name) == -1);
    for (const entity of this.EntityTypes) {
      if (entity.Abstract || !entity.KeyName) {
        continue;
      }
      const entitySet = this.EntitySet.find(a => a.EntityType == "Microsoft.Dynamics.CRM." + entity.Name);
      entity.EntitySetName = entitySet?.EntitySetName;
    }
  }

  isCollection(typeValue?: string): boolean {
    if (typeValue && typeValue.startsWith("Collection(")) {
      return true;
    }
    return false;
  }

  removeCollection(typeValue: string): string {
    if (typeValue) {
      let typeValueCollection = typeValue.replace("Collection(", "");
      if (typeValueCollection.endsWith(")")) {
        typeValueCollection = typeValueCollection.substr(0, typeValueCollection.length - 1);
      }
      return typeValueCollection;
    }
    return typeValue;
  }

  readEntitySets(): void {
    for (const item of this.Metadata["EntityContainer"]["EntitySet"]) {
      const entityset = {
        EntitySetName: item._attributes["Name"],
        Name: item._attributes["Name"],
        EntityType: item._attributes["EntityType"],
      } as EntitySet;
      this.EntitySet.push(entityset);
    }
  }

  readComplexTypes(): void {
    for (const item of this.Metadata["ComplexType"]) {
      const complexType = {
        Name: item._attributes["Name"],
        ReferencedBy: [],
        ReferencedByRoot: [],
        NavigationProperties: [],
        Properties: [],
      } as ComplexType;

      // Add properties
      complexType.Properties = this.getProperties(item);

      // Add Navigation
      complexType.NavigationProperties = this.getNavigation(item);
      this.ComplexTypes.push(complexType);
    }
  }

  readEnums(): void {
    for (const item of this.Metadata["EnumType"]) {
      const enumType = {
        Name: item._attributes["Name"],
        Value: item._attributes["Value"],
        ReferencedBy: [],
        ReferencedByRoot: [],
        StringMembers: true,
        Members: [],
      } as EnumType;
      // If only one item, make array
      if (item.Member.length == undefined) {
        item.Member = [item.Member];
      }
      for (const member of item.Member) {
        const memberDef = {
          Name: member._attributes["Name"],
          Value: member._attributes["Value"],
        } as EnumMember;
        enumType.Members?.push(memberDef);
      }

      this.EnumTypes.push(enumType);
    }
  }

  readFunctions(): void {
    for (const item of this.Metadata["Function"]) {
      const functionItem = {} as FunctionType;
      this.readFunction(functionItem, item);
      // Add properties
      functionItem.Properties = this.getProperties(item);

      // Add Navigation
      functionItem.NavigationProperties = this.getNavigation(item);
      this.Functions.push(functionItem);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readFunction(functionType: FunctionType, item: any): void {
    functionType.Name = item._attributes["Name"];
    functionType.IsBound = item._attributes["IsBound"] == "true";
    functionType.ReturnType = item.ReturnType?._attributes["Type"];
    functionType.ReferencedBy = [];
    functionType.ReferencedByRoot = [];
    if (functionType.ReturnType && this.isCollection(functionType.ReturnType)) {
      functionType.ReturnType = this.removeCollection(functionType.ReturnType);
      functionType.ReturnsCollection = true;
    }

    if (item.Parameter && !item.Parameter.length) {
      // Make into an array because XML-JSON doesn't know it should be if there is just a single value
      item.Parameter = [item.Parameter];
    }

    const parms: FunctionParameterType[] = [];
    if (item.Parameter && item.Parameter.length) {
      for (const param of item.Parameter) {
        const paramType = {
          Name: param._attributes["Name"],
          Type: param._attributes["Type"],
          Nullable: param._attributes["Nullable"] != "false",
        } as FunctionParameterType;
        parms.push(paramType);
      }
    }
    functionType.Parameters = parms;
  }

  readActions(): void {
    for (const item of this.Metadata["Action"]) {
      const action = {} as ActionType;
      this.readFunction(action, item);
      // Add properties
      action.Properties = this.getProperties(item);
      // Add Navigation
      action.NavigationProperties = this.getNavigation(item);
      this.Actions.push(action);
    }
  }

  readEntityTypes(): void {
    for (const entity of this.Metadata["EntityType"]) {
      const entityType = {
        Name: entity._attributes["Name"],
        BaseType: entity._attributes["BaseType"],
        Key: entity.Key,
        KeyName: entity.Key?.PropertyRef?._attributes["Name"],
        Abstract: entity._attributes["Abstract"] == "true",
        Properties: [],
        OpenType: false,
        NavigationProperties: [],
        ReferencedBy: [],
      } as EntityType;
      // Add properties
      entityType.Properties = this.getProperties(entity);
      // Add Navigation
      entityType.NavigationProperties = this.getNavigation(entity);
      this.EntityTypes.push(entityType);
      this._entityTypeIndex[entityType.Name] = entityType;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getProperties(entity: any): EntityTypeProperty[] {
    let properties: EntityTypeProperty[] = [];
    if (entity.Property && !entity.Property.length) {
      // Make into an array because XML-JSON doesn't know it should be if there is just a single value
      entity.Property = [entity.Property];
    }
    if (entity.Property && entity.Property.length) {
      for (const property of entity.Property) {
        const propertyItem = {
          Name: property._attributes["Name"],
          Nullable: property._attributes["Nullable"],
          Type: property._attributes["Type"],
        } as EntityTypeProperty;
        properties.push(propertyItem);
      }
      // Order by name
      properties = properties.sort((a, b) => (a.Name > b.Name ? -1 : 1));
    }
    return properties;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getNavigation(entity: any): EntityTypeNavigationProperty[] {
    let navigation: EntityTypeNavigationProperty[] = [];
    if (entity.NavigationProperty && !entity.NavigationProperty.length) {
      // xml to json don't convert arrays if just one item
      entity.NavigationProperty = [entity.NavigationProperty];
    }
    if (entity.NavigationProperty && entity.NavigationProperty.length) {
      for (const nav of entity.NavigationProperty) {
        const navItem = {
          Name: this.getNavigationName(nav._attributes["Name"]),
          FullName: nav._attributes["Name"],
          IsCollection: this.isCollection(nav._attributes["Type"]),
          Type: this.removeCollection(nav._attributes["Type"]),
          ReferencedProperty: nav.ReferentialConstraint?._attributes["ReferencedProperty"],
          ReferentialConstraint: nav.ReferentialConstraint?._attributes["Property"],
        } as EntityTypeNavigationProperty;
        navItem.LogicalName = navItem.Type.indexOf(".") > -1 ? this.lastValue(navItem.Type.split(".")) : navItem.Type;
        navigation.push(navItem);
      }
      // Order by name
      navigation = navigation.sort((a, b) => (a.Name > b.Name ? -1 : 1));
    }
    return navigation;
  }

  private getNavigationName(name: string): string {
    return this.lastValue(name.split("."));
  }
}
