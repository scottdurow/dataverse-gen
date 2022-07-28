import { MetadataService } from "../MetadataService";
import { SchemaModel } from "../SchemaModel";
import * as fs from "fs";
import * as path from "path";
import { getModel } from "./helpers";
import { EnumMember } from "../EdmxTypes";
describe("SchemaModel", () => {
  let model: SchemaModel;
  beforeAll(async () => {
    const projectDir = path.resolve(".");
    const edmx = fs.readFileSync(path.join(projectDir, "src/__tests__/data/edmx.xml")).toString();
    const metadataService = {
      getEdmxMetadata: jest.fn().mockReturnValue(edmx),
      getEntityMetadata: jest.fn(),
    } as MetadataService;

    model = new SchemaModel(metadataService, {});
    await model.loadEdmxMetadata();
  });
  it("handles single value enums", async () => {
    // Check single value enums
    expect(model.EnumTypes.find((e) => e.Name === "SolutionOperationType")?.Members).toHaveLength(1);
  });
  it("sorts complex type enum name/values by value", async () => {
    // Check single value enums
    /* 
    <EnumType Name="AccessRights" IsFlags="true">
        <Member Name="None" Value="0"/>
        <Member Name="ReadAccess" Value="1"/>
        <Member Name="WriteAccess" Value="2"/>
        <Member Name="AppendAccess" Value="4"/>
        <Member Name="AppendToAccess" Value="16"/>
        <Member Name="CreateAccess" Value="32"/>
        <Member Name="DeleteAccess" Value="65536"/>
        <Member Name="ShareAccess" Value="262144"/>
        <Member Name="AssignAccess" Value="524288"/>
    </EnumType>
    */

    const accessRightsEnum = model.EnumTypes.find((e) => e.Name === "AccessRights");
    expect(accessRightsEnum?.Members).toHaveLength(9);
    if (accessRightsEnum?.Members) {
      expect(accessRightsEnum?.Members[0].Value).toBe("0");
      expect(accessRightsEnum?.Members[0].Name).toBe("None");
      expect(accessRightsEnum?.Members[8].Value).toBe("524288");
      expect(accessRightsEnum?.Members[8].Name).toBe("AssignAccess");
    }
  });

  it("sorts option set enum name/values by value", async () => {
    const defaultOptions = {
      entities: ["queueitem"],
      actions: [],
      functions: [],
    };
    const model = await getModel(defaultOptions);

    const objectTypeCodeEnum = model.EnumTypes.find((e) => e.Name === "queueitem_queueitem_objecttypecode");

    expect(objectTypeCodeEnum).toBeDefined();
    const sortedEnums = [...(objectTypeCodeEnum?.Members as EnumMember[])].sort((a, b) =>
      Number.parseInt(a.Value) < Number.parseInt(b.Value) ? -1 : 1,
    );
    // Check that the members are correctly sorted
    const originalOrder = objectTypeCodeEnum?.Members?.map((m) => m.Value).join(",");
    const sortedOrder = sortedEnums?.map((m) => m.Value).join(",");
    expect(originalOrder).toBe(sortedOrder);
  });

  it("handles single property entities", () => {
    const singlePropertyEntity = model.EntityTypes.find((e) => e.Name === "EntityNameAttributeMetadata");
    expect(singlePropertyEntity?.Properties).toHaveLength(1);
    expect(singlePropertyEntity?.Properties[0].Name).toBe("IsEntityReferenceStored");
  });

  it("sorts entity columns by name", () => {
    const account = model.EntityTypes.find((e) => e.Name === "account");
    expect(account?.Properties).toBeDefined();
    if (account?.Properties) {
      expect(account?.Properties.length).toBe(164);
      expect(account?.Properties[0].Name).toBe("_cdsify_account1_value");
      expect(account?.Properties[account?.Properties.length - 1].Name).toBe("yominame");
    }
  });

  it("handles single navigation properties", () => {
    const entity = model.EntityTypes.find((e) => e.Name === "OneToManyRelationshipMetadata");
    expect(entity?.NavigationProperties).toHaveLength(1);
  });

  it("sorts navigation properties", () => {
    const entity = model.EntityTypes.find((e) => e.Name === "actioncarduserstate");
    expect(entity?.NavigationProperties).toHaveLength(3);
    expect(entity?.NavigationProperties[0].Name).toBe("actioncardid");
    expect(entity?.NavigationProperties[2].Name).toBe("transactioncurrencyid");
  });

  it("sets logical name from type", () => {
    const entity = model.EntityTypes.find((e) => e.Name === "actioncarduserstate");
    const navProperty = entity?.NavigationProperties[2];
    expect(navProperty).toMatchObject({
      Type: "mscrm.transactioncurrency",
      LogicalName: "transactioncurrency",
      FullName: "transactioncurrencyid",
      ReferencedProperty: "transactioncurrencyid",
      ReferentialConstraint: "_transactioncurrencyid_value",
    });
  });

  it("sets collection navigation properties", () => {
    const entity = model.EntityTypes.find((e) => e.Name === "EntityMetadata");
    const navProperty = entity?.NavigationProperties[0]; //Attributes
    expect(navProperty).toMatchObject({
      IsCollection: true,
      FullName: "Attributes",
      Type: "mscrm.AttributeMetadata",
    });
  });

  it("sets complex type navigation properties", () => {
    const complexType = model.ComplexTypes.find((e) => e.Name === "cdsify_UnboundEchoResponse");
    const navProperty = complexType?.NavigationProperties.find((p) => p.Name === "cdsify_UnboundOutEntity");
    expect(navProperty).toMatchObject({
      IsCollection: false,
      FullName: "cdsify_UnboundOutEntity",
      Type: "mscrm.cdsify_integrationtest",
    });
  });

  it("removes system entities", () => {
    expect(model.EntityTypes.find((e) => e.Name === "expando")).toBeUndefined();
    expect(model.EntityTypes.find((e) => e.Name === "prinicpal")).toBeUndefined();
    expect(model.EntityTypes.find((e) => e.Name === "crmbaseentity")).toBeUndefined();
    expect(model.EntityTypes.find((e) => e.Name === "crmmodelbaseentity")).toBeUndefined();
  });

  it("sets entity set name", () => {
    expect(model.EntityTypes.find((a) => a.Name === "account")?.EntitySetName).toBe("accounts");
  });
});
