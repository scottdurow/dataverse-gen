/* eslint-disable sonarjs/cognitive-complexity */
import * as minimist from "minimist";
import { DataverseMetadataService } from "./MetadataService";
export enum DataverseGenCommands {
  Init = "init",
  Eject = "eject",
  Help = "help",
}
const commands: string[] = [DataverseGenCommands.Init, DataverseGenCommands.Eject, DataverseGenCommands.Help];

export class DataverseGenArgs {
  constructor(processArgs: string[]) {
    const args = minimist(processArgs, {
      alias: { environment: "e", tenantId: "t", applicationId: "a", clientSecret: "s" },
    });
    this.verboseLogging = args.verbose || args.v || false;
    this.environmentUrl = args.u || args.e;
    this.tenantId = args.t;
    this.applicationId = args.applicationId || args.a;
    this.clientSecret = args.clientSecret || args.s || args.cs;
    this.command = processArgs.find((a) => commands.indexOf(a) > -1);
  }

  public outputHelp() {
    console.log("Usage: npx dataverse-gen [command] [-u] [-t] [-a] [-cs]");
    console.log("  dataverse-gen : Generates from an existing .dataverse-gen.json file");
    console.log("  dataverse-gen init  : Adds .dataverse-gen.json config file to your project");
    console.log("  dataverse-gen eject : Adds the templates to your project to allow you to customize them!");
    console.log("  -u:  Optional: The url of the environment to connect to e.g. 'https://myorg.crm.dynamics.com'.");
    console.log("       If not provided, the environment is selected from the list created using dataverse-auth");
    console.log("  -t:  Optional: The Tenant Id if using an application user to connect.");
    console.log("  -a:  Optional: The Application Id if using an application user to connect.");
    console.log("  -s:  Optional: The Client Secret if using an application user to connect.");
  }

  public connectedService?: DataverseMetadataService;
  public command?: string;
  public environmentUrl: string;
  public tenantId?: string;
  public applicationId?: string;
  public clientSecret?: string;
  public verboseLogging = false;
}
