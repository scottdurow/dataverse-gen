import path = require("path");
import * as fs from "fs";
import { DataverseGenOptions } from "./MetadataGeneratorConfig";

export interface CodeWriter {
  write(outFile: string, output: string): void;
  createSubFolder(outputDirectory: string): void;
}

export class FileSystemCodeWriter implements CodeWriter {
  private rootPath: string;

  constructor(options: DataverseGenOptions) {
    const projectDir = path.resolve(".");
    if (options.output?.outputRoot) {
      this.rootPath = path.join(projectDir, options.output?.outputRoot);
    } else {
      throw new Error("outputRoot required");
    }

    // Check if the root folder exists
    if (fs.existsSync(this.rootPath)) {
      throw new Error(`Root source directory specified in .dataverse-gen.json '${this.rootPath}' does not exist`);
    }
    this.createDir(this.rootPath);
  }

  write(outFile: string, output: string) {
    const outPath = path.join(this.rootPath, outFile);
    fs.writeFileSync(outPath, output);
  }

  createDir(dirPath: string): void {
    try {
      fs.mkdirSync(dirPath);
    } catch (ex) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ex as any).code !== "EEXIST") {
        throw ex;
      }
    }
  }

  createSubFolder(outputDirectory: string): void {
    this.createDir(path.join(this.rootPath, outputDirectory));
  }
}
