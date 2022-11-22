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
import { Dictionary, StructuralProperty } from "dataverse-ify";
import { TypeScriptType, TypeScriptTypes } from "./TypeScriptType";
import { DataverseGenOptions, defaultOptions } from "./MetadataGeneratorConfig";
import { ComplexEntityMetadata } from "./dataverse-gen/complextypes/ComplexEntityMetadata";
import { MetadataService } from "./MetadataService";
import { ComplexAttributeMetadata } from "./dataverse-gen/complextypes/ComplexAttributeMetadata";
import { AttributeRequiredLevel } from "./dataverse-gen/enums/AttributeRequiredLevel";
import _merge = require("lodash.merge");

export class SchemaModel {
  options: DataverseGenOptions = {};
  EntityTypes: EntityType[] = [];
  EntitySet: EntitySet[] = [];
  ComplexTypes: ComplexType[] = [];
  Association: Association[] = [];
  EnumTypes: EnumType[] = [];
  Functions: FunctionType[] = [];
  Actions: ActionType[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private Metadata!: { [key: string]: any };
  private entityTypeIndex: Dictionary<EntityType> = {};
  private enums: Dictionary<EnumType> = {};
  private metadataService: MetadataService;
  constructor(metadataService: MetadataService, options: DataverseGenOptions = {}) {
    this.options = {};
    _merge(this.options, defaultOptions, options);
    this.metadataService = metadataService;
  }

  public async loadEdmxMetadata() {
    if (!this.Metadata) {
      const metadataXml = await this.metadataService.getEdmxMetadata();
      const metadataJsonString = convert.xml2json(metadataXml, { compact: true, spaces: 4 });
      const metadataJson = JSON.parse(metadataJsonString);
      this.Metadata = metadataJson["edmx:Edmx"]["edmx:DataServices"].Schema;
      this.readEnums();
      this.readEntityTypes();
      this.readEntitySets();
      this.setEntitySetName();
      this.readComplexTypes();
      this.readActions();
      this.readFunctions();
    }
  }

  public async generate(): Promise<void> {
    // Get the Entity Data Model
    await this.loadEdmxMetadata();

    // Filter based on the options
    this.filter();

    // Add the metadata not in the EDMX using the Dataverse WebApi
    await this.addEntityMetadata();
    this.updateMappedComplexTypeNames();
    this.setTypeScriptTypes();
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private setTypeScriptTypes(): void {
    for (const item of this.ComplexTypes) {
      for (const param of item.Properties) {
        param.TypescriptType = this.getTypeScriptType(param);
      }

      for (const param of item.NavigationProperties) {
        param.TypescriptType = this.getTypeScriptType({
          Type: param.IsCollection ? `Collection(${param.Type})` : param.Type,
        });
      }
    }
    for (const item of this.Actions) {
      for (const param of item.Properties) {
        param.TypescriptType = this.getTypeScriptType(param);
      }
      for (const param of item.Parameters) {
        param.TypescriptTypes = this.getParameterTypeScriptType(param);
        // Special case
        // For entity/table bound actions, remove the Collection part of the type
        this.CorrectFunctionActionEntitySetParameter(param);
      }
    }
    for (const item of this.Functions) {
      for (const param of item.Properties) {
        param.TypescriptType = this.getTypeScriptType(param);
      }
      for (const param of item.Parameters) {
        param.TypescriptTypes = this.getParameterTypeScriptType(param);
        // Special case
        // For entity/table bound actions, remove the Collection part of the type
        this.CorrectFunctionActionEntitySetParameter(param);
      }
    }
    for (const item of this.EntityTypes) {
      for (const property of item.Properties) {
        property.TypescriptType = this.getTypeScriptType(property);
      }
    }
  }

  private CorrectFunctionActionEntitySetParameter(param: FunctionParameterType) {
    if (param.Name === "entityset" && param.structuralTypeName === "Collection") {
      param.Type = this.removeCollection(param.Type);
    }
  }

  private updateMappedComplexTypeNames(): void {
    // Check if we are mapping any names to alternatives
    // Eg. Special case for mscrm.Object => ObjectValue
    for (const complexType of this.ComplexTypes) {
      complexType.Name = this.mapTypeName(complexType.Name);
    }
  }

  private mapTypeName(typeName: string): string {
    const mapping = this.options.referencedTypes && this.options.referencedTypes[typeName];
    if (mapping && mapping.name) {
      return mapping.name;
    }
    return typeName;
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async addEntityMetadata(): Promise<void> {
    for (const entity of this.EntityTypes) {
      const getMetadataResponse = await this.metadataService.getEntityMetadata(entity.Name);
      if (!getMetadataResponse.EntityMetadata || getMetadataResponse.EntityMetadata?.length === 0)
        throw new Error(`${entity.Name} is not a Dataverse entity, remove it from the .dataverse-gen.json`);
      const entityMetadata = getMetadataResponse.EntityMetadata[0] as ComplexEntityMetadata;
      if (!entityMetadata.LogicalName) continue;
      const entityType = this.entityTypeIndex[entityMetadata.LogicalName];

      // Set the additional properties that are not available in the edmx
      entityType.SchemaName = entityMetadata.SchemaName;
      entityType.EntitySetName = entityMetadata.EntitySetName;

      // Re-add the properties with all the information required (not in the emdx)
      entityType.Properties = [];
      if (!entityMetadata.Attributes) continue;

      const nonVirtualAttributes = entityMetadata.Attributes.filter(
        (a) => a.AttributeTypeName?.Value !== "VirtualType",
      ).sort((a, b) => (a < b ? -1 : 1));

      for (const attribute of nonVirtualAttributes) {
        // If the attribute is a PickList or Status Type then add the enum
        const attributeType = attribute.AttributeTypeName?.Value;
        let typeName = attribute.AttributeTypeName?.Value;
        let dateFormat = "";
        let multiSelect = false;
        let optionSetEnum: EnumType | undefined = undefined;
        switch (attributeType) {
          case "DateTimeType": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dateFormat = (attribute as any).Format.toString() + ":" + (attribute as any).DateTimeBehavior?.Value;
            break;
          }
          case "CustomerType":
          case "LookupType": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.addLookupType(attribute, entityType);
            break;
          }
          case "PicklistType": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const optionSet = attribute as any;
            optionSetEnum = this.addEnum(optionSet.OptionSet, entityMetadata);
            break;
          }
          case "MultiSelectPicklistType": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            optionSetEnum = this.addEnum((attribute as any).OptionSet, entityMetadata);
            multiSelect = true;
            break;
          }
          case "StatusType": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            optionSetEnum = this.addEnum((attribute as any).OptionSet, entityMetadata);
            break;
          }
          case "StateType": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            optionSetEnum = this.addEnum((attribute as any).OptionSet, entityMetadata);
            break;
          }
        }
        if (optionSetEnum) {
          typeName = optionSetEnum.Name;
        }
        const property = this.getEntityTypePropertyFromMetadata(
          typeName,
          attribute,
          optionSetEnum,
          dateFormat,
          multiSelect,
        );
        entityType.Properties.push(property);
      }
    }
  }

  private getEntityTypePropertyFromMetadata(
    typeName: string | undefined,
    attribute: ComplexAttributeMetadata,
    optionSetEnum: EnumType | undefined,
    dateFormat: string,
    multiSelect: boolean,
  ) {
    return {
      Type: typeName,
      Name: attribute.LogicalName,
      SchemaName: attribute.SchemaName,
      IsRequired: attribute.RequiredLevel?.Value === AttributeRequiredLevel.ApplicationRequired,
      IsEnum: optionSetEnum !== undefined,
      Description: attribute.Description?.UserLocalizedLabel ? attribute.Description.UserLocalizedLabel.Label : "",
      DisplayName: attribute.DisplayName?.UserLocalizedLabel ? attribute.DisplayName.UserLocalizedLabel.Label : "",
      Format: dateFormat,
      IsMultiSelect: multiSelect,
      AttributeOf: attribute.AttributeOf,
      SourceType: attribute.SourceType,
    } as EntityTypeProperty;
  }

  private addLookupType(attribute: ComplexAttributeMetadata, entityType: EntityType) {
    const lookup = attribute as { Targets: string[] };

    if (lookup.Targets.length > 0) {
      const relatedNav = entityType.NavigationProperties.filter((a: { Name: string }) =>
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
  }

  private getOutputType(structuralType: StructuralProperty, typeName: string) {
    let outputType: TypeScriptTypes;
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
    return { outputType, typeName };
  }

  private structuralPropertyToString(value: StructuralProperty): string {
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
      default:
        return "PrimitiveType";
    }
  }

  private resolveTypeToImportLocation(typeName: string, outputType: TypeScriptTypes): string | undefined {
    // Is there a mapping direct map
    const typeNameImport = typeName.replace("[]", "");
    if (this.options.referencedTypes && this.options.referencedTypes[typeNameImport]) {
      return this.options.referencedTypes[typeNameImport].import;
    }
    if (this.options.referencedTypes) {
      switch (outputType) {
        case TypeScriptTypes.enumType:
          return this.options.referencedTypes["enums"].import + typeNameImport;
        case TypeScriptTypes.entityType: {
          return this.options.referencedTypes["entityTypes"].import + typeNameImport;
        }
        case TypeScriptTypes.complexType:
          return this.options.referencedTypes["complexTypes"].import + typeNameImport;
      }
    }
    return undefined;
  }

  private resolveToEntityType(logicalName: string): string | undefined {
    // Since the schema names are used for entity types, we must find the schema name
    const entity = this.EntityTypes.find((e) => e.Name.toLowerCase() === logicalName.toLowerCase());
    if (entity) return entity.SchemaName;
    else {
      return undefined;
    }
  }

  private resolveToComplexType(logicalName: string): string {
    const complexType = this.ComplexTypes.find((e) => e.Name === logicalName);
    if (complexType) return complexType.Name;
    else {
      return logicalName;
    }
  }

  private resolveToEnumType(logicalName: string): string | undefined {
    const enumType = this.EnumTypes.find((e) => e.Name === logicalName);
    if (enumType != null) return enumType.Name;
    else {
      return undefined;
    }
  }

  private getStructuralType(param: FunctionParameterType): StructuralProperty {
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

  // eslint-disable-next-line sonarjs/cognitive-complexity
  protected getParameterTypeScriptType(param: FunctionParameterType): TypeScriptType[] | undefined {
    let typeName = "any";
    let outputType: TypeScriptTypes = TypeScriptTypes.primitive;
    let structuralType = this.getStructuralType(param);
    let paramType = param.Type;
    if (structuralType === StructuralProperty.Collection) {
      // Strip the collection
      paramType = this.removeCollection(param.Type);
    }
    if (paramType.startsWith("Edm.")) {
      switch (paramType) {
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
      }
      if (structuralType === StructuralProperty.Collection) typeName += "[]";
    } else {
      // Complex Type or Entity
      typeName = this.lastValue(paramType.split("."));
      if (typeName === "crmbaseentity") {
        typeName = "any";
        if (structuralType === StructuralProperty.Collection) typeName += "[]";
      } else {
        // If complex type - it could still be an entity
        if (
          structuralType === StructuralProperty.ComplexType &&
          this.EntityTypes.find((a) => a.Name.toLowerCase() === typeName.toLowerCase())
        ) {
          structuralType = StructuralProperty.EntityType;
        }
        ({ outputType, typeName } = this.getOutputType(structuralType, typeName));
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

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private getTypeScriptType(property: { Type: string; IsMultiSelect?: boolean; IsEnum?: boolean }): TypeScriptType {
    const referencedType = property.Type;
    const isMultiSelect = property.IsMultiSelect;
    const isCollection = this.isCollection(referencedType);
    const typeName = this.removeCollection(referencedType);
    let definitelyTypedFieldType: string | undefined;
    let type = "any";

    switch (typeName) {
      case "MultiSelectPicklistType":
        type = "number[]";
        break;
      case "PicklistType":
      case "StateType":
      case "StatusType":
        type = "number";
        definitelyTypedFieldType = "OptionSet";
        break;
      case "Edm.Guid":
      case "UniqueidentifierType":
        type = "Guid";
        break;
      case "ImageType":
      case "FileType":
      case "Edm.String":
      case "StringType":
      case "Edm.Duration":
      case "Edm.Binary":
      case "MemoType":
      case "EntityNameType":
        type = "string";
        definitelyTypedFieldType = "String";
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
        definitelyTypedFieldType = "Number";
        break;
      case "Edm.Boolean":
      case "BooleanType":
        type = "boolean";
        definitelyTypedFieldType = "Boolean";
        break;
      case "Edm.DateTimeOffset":
      case "DateTimeType":
        type = "Date";
        definitelyTypedFieldType = "Date";
        break;
      case "CustomerType":
      case "LookupType":
      case "OwnerType":
        type = "EntityReference";
        definitelyTypedFieldType = "Lookup";
        break;
      case "PartyListType":
        type = "ActivityParty[]";
        definitelyTypedFieldType = "OptionSet";
        break;
      case "ManagedPropertyType":
        type = "number";
        break;
      default:
        {
          type =
            typeName.indexOf(".") > -1 ? this.lastValue(typeName.split(".").filter((a) => a && a !== "")) : typeName;
        }
        break;
    }
    let outputType = property.IsEnum ? TypeScriptTypes.enumType : TypeScriptTypes.primitive;
    if (type === "crmbaseentity") {
      type = "any";
    } else {
      // Check if it is an enum
      const enumType = this.EnumTypes.find((e) => e.Name === type);
      if (enumType) {
        property.IsEnum = true;
        outputType = TypeScriptTypes.enumType;
      }
      // E.g. Special case because we don't want an interface called 'Object'
      type = this.mapTypeName(type);

      // Check if it is an entity type
      const entityType = this.EntityTypes.find((e) => e.SchemaName === type || e.Name === type);
      if (entityType) {
        type = entityType.SchemaName as string;
        outputType = TypeScriptTypes.entityType;
      }
      const complexType = this.ComplexTypes.find((e) => e.Name === type);
      if (complexType) {
        outputType = TypeScriptTypes.complexType;
      }
    }
    // Add array
    if (isCollection || isMultiSelect) {
      type = type + "[]";
    }
    return {
      name: type,
      outputType: outputType,
      importLocation: this.resolveTypeToImportLocation(type, outputType),
      definitelyTypedAttributeType: property.IsEnum
        ? "Xrm.Attributes.OptionSetAttribute"
        : `Xrm.Attributes.${definitelyTypedFieldType}Attribute`,
      definitelyTypedControlType:
        property.IsEnum || property.Type === "BooleanType"
          ? "Xrm.Controls.OptionSetControl"
          : `Xrm.Controls.${definitelyTypedFieldType}Control`,
    } as TypeScriptType;
  }

  private lastValue<T>(arrayValue: T[]): T {
    return arrayValue[arrayValue.length - 1];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addEnum(options: any, entity: ComplexEntityMetadata): EnumType {
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
    // If this is not a global option set then prefix with the attribute logical name
    if (options.IsGlobal !== true) {
      optionSetEnum.Name = entity.LogicalName + "_" + optionSetEnum.Name;
    }
    // Check if the global option set hasn't been added already
    else {
      if (!this.enums[optionSetEnum.Name]) {
        this.enums[optionSetEnum.Name] = optionSetEnum;
      } else {
        addEnum = false;
      }
    }
    if (addEnum) {
      // Sort members numerically
      optionSetEnum.Members?.sort((a, b) => (Number.parseInt(a.Value) < Number.parseInt(b.Value) ? -1 : 1));
      this.EnumTypes.push(optionSetEnum);
    }
    return optionSetEnum;
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private filter(): void {
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
      filteredActions = this.Actions.filter((a) => this.options.actions?.find((f) => a.Name === f));
    }

    let filteredFunctions: FunctionType[] = [];
    if (this.options.functions) {
      filteredFunctions = this.Functions.filter((a) => this.options.functions?.find((f) => a.Name === f));
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
    for (const complexType of this.ComplexTypes.filter((a) => a.ReferencedBy.length > 0)) {
      this.addComplexTypeReferences(complexType);
    }

    // Remove all the entities that are not used and not included in the filter
    const filteredEntities = this.options.entities
      ? this.EntityTypes.filter((e) => this.options.entities && this.options.entities.indexOf(e.Name) > -1)
      : this.EntityTypes;

    this.EntityTypes = this.EntityTypes.filter((e) => e.ReferencedBy.length > 0 || filteredEntities.indexOf(e) > -1);

    // Remove actions not included in the filter
    this.Actions = this.Actions.filter((e) => filteredActions.indexOf(e) > -1);

    // Remove the functions not included in the filter
    this.Functions = this.Functions.filter((e) => filteredFunctions.indexOf(e) > -1);

    // Remove Complex types that are not referenced by actions or functions
    this.ComplexTypes = this.ComplexTypes.filter(
      (t) => t.ReferencedBy.length > 0 || (t.ReferencedByRoot && t.ReferencedByRoot.length > 0),
    );

    // Remove Enums that are not referenced by complex types, actions or functions
    this.EnumTypes = this.EnumTypes.filter(
      (t) => (t.ReferencedByRoot && t.ReferencedByRoot.length > 0) || (t.ReferencedBy && t.ReferencedBy.length > 0),
    );
  }

  private makeCodeSafe(name: string): string {
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
  private isNumeric(s: any): boolean {
    return !isNaN(s - parseFloat(s));
  }

  private getReferencedType(fullType: string): string {
    if (this.isCollection(fullType)) {
      return this.removeCollection(fullType) as string;
    } else return fullType;
  }

  private getShortType(fullType: string): string {
    const parts = this.getReferencedType(fullType).split(".");
    if (parts && parts.length > 0) {
      return parts[parts.length - 1];
    }
    return "";
  }

  private addComplexTypeReferences(complexType: ComplexType): void {
    for (const property of complexType.Properties) {
      const shortType = this.getShortType(property.Type);
      // If the type is a complex type then add the reference
      const matchingType: ComplexType = this.ComplexTypes.find((c) => c.Name === shortType) as ComplexType;
      const matchingEnum: EnumType = this.EnumTypes.find((e) => e.Name === shortType) as EnumType;
      if (matchingType) {
        if (!matchingType.ReferencedByRoot) matchingType.ReferencedByRoot = [];
        if (matchingType.ReferencedByRoot.indexOf(complexType) === -1) {
          matchingType.ReferencedByRoot.push(complexType);
          this.addComplexTypeReferences(matchingType);
        }
      } else if (matchingEnum && matchingEnum.ReferencedByRoot?.indexOf(complexType) === -1) {
        matchingEnum.ReferencedByRoot?.push(complexType);
      }
    }
  }

  private setEntitySetName(): void {
    // Remove System Entities
    const systemEntities = ["crmbaseentity", "principal", "crmmodelbaseentity", "expando"];
    this.EntityTypes = this.EntityTypes.filter((a) => systemEntities.indexOf(a.Name) === -1);
    for (const entity of this.EntityTypes) {
      if (entity.Abstract || !entity.KeyName) {
        continue;
      }
      const entitySet = this.EntitySet.find((a) => a.EntityType === "Microsoft.Dynamics.CRM." + entity.Name);
      entity.EntitySetName = entitySet?.EntitySetName;
    }
  }

  private isCollection(typeValue?: string): boolean {
    return typeValue !== undefined && typeValue.startsWith("Collection(");
  }

  private removeCollection(typeValue: string): string {
    if (typeValue) {
      let typeValueCollection = typeValue.replace("Collection(", "");
      if (typeValueCollection.endsWith(")")) {
        typeValueCollection = typeValueCollection.substring(0, typeValueCollection.length - 1);
      }
      return typeValueCollection;
    }
    return typeValue;
  }

  private readEntitySets(): void {
    for (const item of this.Metadata["EntityContainer"]["EntitySet"]) {
      const entitySet = {
        EntitySetName: item._attributes["Name"],
        Name: item._attributes["Name"],
        EntityType: item._attributes["EntityType"],
      } as EntitySet;
      this.EntitySet.push(entitySet);
    }
    this.EntitySet.sort((a, b) => (a.Name > b.Name ? 1 : -1));
  }

  private readComplexTypes(): void {
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
    this.ComplexTypes.sort((a, b) => (a.Name > b.Name ? 1 : -1));
  }

  private readEnums(): void {
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
      if (item.Member.length === undefined) {
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
      this.EnumTypes.sort((a, b) => (Number.parseInt(a.Value as string) > Number.parseInt(b.Value as string) ? 1 : -1));
    }
  }

  private readFunctions(): void {
    for (const item of this.Metadata["Function"]) {
      const functionItem = {} as FunctionType;
      this.readFunction(functionItem, item);
      // Add properties
      functionItem.Properties = this.getProperties(item);

      // Add Navigation
      functionItem.NavigationProperties = this.getNavigation(item);
      this.Functions.push(functionItem);
    }
    this.Functions.sort((a, b) => (a.Name > b.Name ? 1 : -1));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readFunction(functionType: FunctionType, item: any): void {
    functionType.Name = item._attributes["Name"];
    functionType.IsBound = item._attributes["IsBound"] === "true";
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

    const params: FunctionParameterType[] = [];
    if (item.Parameter && item.Parameter.length) {
      for (const param of item.Parameter) {
        const paramType = {
          Name: param._attributes["Name"],
          Type: param._attributes["Type"],
          Nullable: param._attributes["Nullable"] !== "false",
        } as FunctionParameterType;
        params.push(paramType);
      }
    }
    functionType.Parameters = params;
  }

  private readActions(): void {
    for (const item of this.Metadata["Action"]) {
      const action = {} as ActionType;
      this.readFunction(action, item);
      // Add properties
      action.Properties = this.getProperties(item);
      // Add Navigation
      action.NavigationProperties = this.getNavigation(item);
      this.Actions.push(action);
    }
    this.Actions.sort((a, b) => (a.Name > b.Name ? 1 : -1));
  }

  private readEntityTypes(): void {
    for (const entity of this.Metadata["EntityType"]) {
      const entityType = {
        Name: entity._attributes["Name"],
        BaseType: entity._attributes["BaseType"],
        Key: entity.Key,
        KeyName: entity.Key?.PropertyRef?._attributes["Name"],
        Abstract: entity._attributes["Abstract"] === "true",
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
      this.entityTypeIndex[entityType.Name] = entityType;
    }
    this.EntityTypes.sort((a, b) => (a.Name > b.Name ? 1 : -1));
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
      properties = properties.sort((a, b) => (a.Name > b.Name ? 1 : -1));
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
      navigation = navigation.sort((a, b) => (a.Name > b.Name ? 1 : -1));
    }
    return navigation;
  }

  private getNavigationName(name: string): string {
    return this.lastValue(name.split("."));
  }
}
