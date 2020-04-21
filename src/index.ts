#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as path from "path";
import * as fs from "fs-extra";
import * as chalk from "chalk";
import { CdsifyOptions } from "./MetadataGeneratorConfig";
import { TypescriptGenerator } from "./TypescriptGenerator";
import * as inquirer from "inquirer";
import { loadTokenCache } from "cdsify/lib/cdsnode/TokenCache";
import { version } from "./version";
import * as minimist from "minimist";
// Load config
const projectDir = path.resolve(".");
const packageDir = path.resolve(__dirname);
const config: CdsifyOptions = readConfig();

console.log(
  chalk.yellow(`
          _     _  __        __  
   ___ __| |___(_)/ _|_   _  \\ \\ 
  / __/ _' / __| | |_| | | |  \\ \\
 | (_| (_| \\__ \\ |  _| |_| |  / /
  \\___\\__,_|___/_|_|  \\__, | /_/ 
                      |___/      
`),
);
console.log(`cdsify-gen v${version}`);
console.log(chalk.gray("Running from package:" + packageDir));
console.log(chalk.gray("Current Project: " + projectDir));

function readConfig(): CdsifyOptions {
  const configPath = path.join(projectDir, ".cdsify.json");
  if (fs.existsSync(configPath)) {
    const configJSON = fs.readFileSync(configPath).toString();
    const config: CdsifyOptions = JSON.parse(configJSON) as CdsifyOptions;
    return config;
  } else {
    return {} as CdsifyOptions;
  }
}

async function main(): Promise<void> {
  const args = minimist(process.argv.slice(2));
  // Check command arg
  const mainArg = args._ && args._[0];
  switch (mainArg) {
    case "help":
    case "h":
    case "?":
      help();
      break;
    case "init":
      init();
      break;
    case "eject":
      eject();
      break;
    default:
      await generate();
      break;
  }
}

function help(): void {
  console.log("  cdsify-gen init  : Adds .cdsify.json config file to your project");
  console.log("  cdsify-gen eject : Adds the templates to your project to allow you to customise them!");
}
function init(): void {
  const pathToTemplate = path.resolve(packageDir, "../.cdsify.template.json");
  const pathToOutput = path.resolve(projectDir, ".cdsify.json");
  console.log(`Initialising project with: ${pathToOutput}`);
  fs.copyFileSync(pathToTemplate, pathToOutput);
}
function eject(): void {
  const templateRoot = config.output?.templateRoot || "./_templates";
  const source = path.resolve(packageDir, "../_templates");
  const target = path.resolve(projectDir, templateRoot);
  console.log(`Ejecting templates to template root ${target}`);
  if (target.indexOf(source) > -1) {
    throw new Error("Template source is the same as the target");
  }
  fs.copySync(source, target);
}

async function generate(): Promise<void> {
  // Pick the auth server to use
  const authConfig = loadTokenCache();
  console.log("Run 'npx cds-auth' to add a new CDS envrionment");
  let i = 1;
  const serverNames: string[] = [];
  for (const server in authConfig) {
    console.log(` (${i})  ${server}`);
    serverNames.push(server);
    i++;
  }
  if (i == 1) {
    console.log("No server auth tokens found.");
    return;
  }

  const selectServer = [
    {
      name: "server",
      type: "input",
      message: "Select the server to connect to:",
      validate: function(value: string): boolean | string {
        const valueNumber = parseInt(value);
        if (valueNumber && valueNumber != NaN && valueNumber < i && valueNumber > 0) {
          return true;
        } else {
          return "Please select a server";
        }
      },
    },
  ];
  const selectServerResponse = await inquirer.prompt(selectServer);
  const serverIndex = selectServerResponse["server"] as string;
  const server = serverNames[parseInt(serverIndex) - 1];
  console.log(`Using server: ${server}`);
  const codeGenerator = new TypescriptGenerator(packageDir, projectDir, config);
  await codeGenerator.generate("https://" + server);
}

main().then(
  () => {
    console.log("Complete!");
  },
  ex => {
    console.log(chalk.red(`Error:${ex.message}`));
    console.log(`Stack:${ex.stack}`);
    console.log(JSON.stringify(ex));
  },
);
