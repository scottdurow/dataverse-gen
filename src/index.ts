#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-use-before-define */
process.env.SUPPRESS_NO_CONFIG_WARNING = "true";
import * as path from "path";
import * as fs from "fs-extra";
import * as chalk from "chalk";
import { DataverseGenOptions } from "./MetadataGeneratorConfig";
import { TypescriptGenerator } from "./TypescriptGenerator";
import { loadTokenCache } from "cdsify/lib/cdsnode/TokenCache";
import { version } from "./version";
import * as minimist from "minimist";
import * as Enquirer from "enquirer";
import { SchemaGenerator } from "./SchemaGenerator";

// Load config
const projectDir = path.resolve(".");
const packageDir = path.resolve(__dirname);
let config: DataverseGenOptions = readConfig();

console.log(
  chalk.yellow(`
       __      __                                        _ ____     
  ____/ /___ _/ /_____ __   _____  _____________        (_) __/_  __
 / __  / __ \`/ __/ __ \`/ | / / _ \\/ ___/ ___/ _ \\______/ / /_/ / / /
/ /_/ / /_/ / /_/ /_/ /| |/ /  __/ /  (__  )  __/_____/ / __/ /_/ / 
\\__,_/\\__,_/\\__/\\__,_/ |___/\\___/_/  /____/\\___/     /_/_/  \\__, /  
                                                           /____/   
`),
);
console.log(`dataverse-gen v${version}`);
console.log(chalk.gray("Running from package:" + packageDir));
console.log(chalk.gray("Current Project: " + projectDir));

function readConfig(): DataverseGenOptions {
  const configPath = path.join(projectDir, ".dataverse-gen.json");
  if (fs.existsSync(configPath)) {
    const configJSON = fs.readFileSync(configPath).toString();
    const config: DataverseGenOptions = JSON.parse(configJSON) as DataverseGenOptions;
    return config;
  } else {
    return {} as DataverseGenOptions;
  }
}

function saveCofig(config: DataverseGenOptions): void {
  const configPath = path.join(projectDir, ".dataverse-gen.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
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
      await init();
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
  console.log("  dataverse-gen init  : Adds .dataverse-gen.json config file to your project");
  console.log("  dataverse-gen eject : Adds the templates to your project to allow you to customise them!");
}
async function init(): Promise<void> {
  const pathToTemplate = path.resolve(packageDir, "../.dataverse-gen.template.json");
  const pathToOutput = path.resolve(projectDir, ".dataverse-gen.json");
  if (!fs.existsSync(pathToOutput)) {
    console.log(`Initialising project with: ${pathToOutput}`);
    fs.copyFileSync(pathToTemplate, pathToOutput);
  } else {
    console.log(`dataverse-gen.json config already added: ${pathToOutput}`);
  }

  const server = await selectServer();
  if (server) {
    // Load EDMX
    const generator = new TypescriptGenerator(packageDir, projectDir, {});
    const metadataXml = await generator.getEdmxMetadata("https://" + server);
    const schema = new SchemaGenerator(metadataXml);
    schema.readEntityTypes();
    schema.readActions();
    schema.readFunctions();
    const entities = schema.EntityTypes.map(e => e.Name);
    const actions = schema.Actions.map(e => e.Name);
    const functions = schema.Functions.map(e => e.Name);

    const questionInfo = "[type to filter list, space to select]";
    const footerMessage = chalk.whiteBright("[Space - Select] [Return Accept] [Scroll up and down to see more]");
    // Ask for entities
    const responses = (await Enquirer.prompt([
      {
        name: "entities",
        type: "autocomplete",
        message: "Select entities to include " + questionInfo,
        multiple: true,
        limit: 10,
        footer() {
          return footerMessage;
        },
        choices: entities,
      } as any,
      {
        name: "actions",
        type: "autocomplete",
        message: "Select actions to include " + questionInfo,
        multiple: true,
        limit: 10,
        footer() {
          return footerMessage;
        },
        choices: actions,
      } as any,
      {
        name: "functions",
        type: "autocomplete",
        message: "Select functions to include " + questionInfo,
        multiple: true,
        limit: 10,
        footer() {
          return footerMessage;
        },
        choices: functions,
      } as any,
    ])) as any;

    // Load config
    const currentConfig = readConfig();
    currentConfig.entities = currentConfig.entities || [];
    currentConfig.actions = currentConfig.actions || [];
    currentConfig.functions = currentConfig.functions || [];

    const updates = {
      entities: 0,
      actions: 0,
      functions: 0,
    };
    // Set entities
    for (const entity of responses.entities) {
      if (currentConfig.entities.indexOf(entity) == -1) {
        currentConfig.entities.push(entity);
        updates.entities++;
      }
    }
    // Set actions
    for (const action of responses.actions) {
      if (currentConfig.actions.indexOf(action) == -1) {
        currentConfig.actions.push(action);
        updates.actions++;
      }
    }
    // Set functions
    for (const functionItem of responses.functions) {
      if (currentConfig.functions.indexOf(functionItem) == -1) {
        currentConfig.functions.push(functionItem);
        updates.functions++;
      }
    }

    if (updates.entities + updates.actions + updates.functions > 0) {
      // Save config
      saveCofig(currentConfig);
      console.log(chalk.green("\n\nConfiguration updated:"));
      console.log(`${chalk.cyanBright(updates.entities)} entities(s) added`);
      console.log(`${chalk.cyanBright(updates.actions)} actions(s) added`);
      console.log(`${chalk.cyanBright(updates.functions)} functions(s) added`);
    } else {
      console.log(chalk.yellow("No items added to configuration"));
    }

    const generateResponse = (await Enquirer.prompt({
      name: "generate",
      type: "confirm",
      message: "Would you like to generate the types now?",
    } as any)) as any;
    if (generateResponse.generate) {
      config = currentConfig;
      await generate(server);
    }
  }
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

async function generate(server?: string): Promise<void> {
  const codeGenerator = new TypescriptGenerator(packageDir, projectDir, config);
  const selectedServer = server || (await selectServer());
  if (selectedServer) {
    await codeGenerator.generate("https://" + selectedServer);
  }
}

async function selectServer(): Promise<string | undefined> {
  // Pick the auth server to use
  const authConfig = loadTokenCache();
  console.log(chalk.blue("Run 'npx dataverse-auth' to add a new Microsoft Dataverse envrionment"));
  let i = 1;
  const serverNames: string[] = [];
  for (const server in authConfig) {
    console.log(` (${i})  ${server}`);
    serverNames.push(server);
    i++;
  }
  if (i == 1) {
    console.log("No server auth tokens found.");
    return undefined;
  }
  const prompt = (await Enquirer.prompt({
    name: "number",
    style: "number",
    type: "numeral",
    min: 1,
    max: serverNames.length,
    round: 0,
    message: "Select server to connect to",
    validate(value: number) {
      if (value < 1 || value > serverNames.length) {
        return chalk.red(`Please select a value between 1 and ${serverNames.length}`);
      }
      return true;
    },
  } as any)) as any;

  const server = serverNames[(prompt.number as number) - 1];
  console.log(`Using server: ${server}`);
  return server;
}

main().then(
  () => {
    console.log(chalk.green("\nComplete!"));
  },
  ex => {
    if (ex.message) {
      console.log(chalk.red(`\nError:${ex.message}`));
      console.log(`Stack:${ex.stack}`);
      console.log(JSON.stringify(ex));
    }
  },
);
