/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataverseGenOptions } from "../MetadataGeneratorConfig";
import { MetadataService } from "../MetadataService";
import { SchemaModel } from "../SchemaModel";
import { TypeScriptType } from "../TypeScriptType";

describe("TypeScriptGenerator Type Mapping", () => {
  it("maps complex type navigation property of type entity", () => {
    const model = new SchemaModel(jest.fn() as unknown as MetadataService, {} as DataverseGenOptions);
    const typeScriptType = model["getParameterTypeScriptType"]({
      Type: "Collection(mscrm.crmbaseentity)",
      IsMultiSelect: false,
      IsEnum: false,
    } as any) as TypeScriptType[];
    expect(typeScriptType[0].name).toBe("any[]");
  });
});
