import path = require("path");
import * as fs from "fs";
import { DataverseGenOptions } from "./MetadataGeneratorConfig";

export interface TemplateProvider {
  getTemplate(templateFileName: string): string;
}

export class FileSystemTemplateProvider implements TemplateProvider {
  private projectTemplateRootPath: string;
  private packageTemplateRootPath: string;
  constructor(options: DataverseGenOptions) {
    const projectDir = path.resolve(".");
    const packageDir = path.resolve(__dirname);

    // Read template from the current project if it exists
    this.projectTemplateRootPath = options.output?.templateRoot
      ? path.join(projectDir, options.output?.templateRoot as string)
      : projectDir;
    this.packageTemplateRootPath = path.join(packageDir, "../_templates");
  }

  public getTemplate(templateFileName: string): string {
    const projectTemplatePath = path.join(this.projectTemplateRootPath, templateFileName);
    const packageTemplatePath = path.join(this.packageTemplateRootPath, templateFileName);

    // If the templates have been ejected, they exist in the local project
    // otherwise pick them up from the package
    let template: string;
    if (fs.existsSync(projectTemplatePath)) {
      template = fs.readFileSync(projectTemplatePath).toString();
    } else {
      template = fs.readFileSync(packageTemplatePath).toString();
    }
    return template;
  }
}
