#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-use-before-define */
process.env.SUPPRESS_NO_CONFIG_WARNING = "true";
import * as chalk from "chalk";
import { getAllUsers } from "dataverse-ify/lib/webapi";
import * as Enquirer from "enquirer";
import * as fs from "fs-extra";
import * as minimist from "minimist";
import * as path from "path";
import { FileSystemCodeWriter } from "./CodeWriter";
import { DataverseGenOptions } from "./MetadataGeneratorConfig";
import { DataverseMetadataService, MetadataService } from "./MetadataService";
import { SchemaModel } from "./SchemaModel";
import { FileSystemTemplateProvider } from "./TemplateProvider";
import { TypescriptGenerator } from "./TypescriptGenerator";
import { version } from "./version";
const projectDir = path.resolve(".");
const packageDir = path.resolve(__dirname);
const configFileName = ".dataverse-gen.json";

function readConfig(): DataverseGenOptions {
  const configPath = path.join(projectDir, configFileName);
  const config: DataverseGenOptions = {};
  if (fs.existsSync(configPath)) {
    console.log(chalk.gray("Loading config: " + configPath));
    const configJSON = fs.readFileSync(configPath).toString();
    const config: DataverseGenOptions = JSON.parse(configJSON) as DataverseGenOptions;
    console.log(`${chalk.cyanBright(config.entities?.length ?? 0)} entities(s)`);
    console.log(`${chalk.cyanBright(config.actions?.length ?? 0)} actions(s)`);
    console.log(`${chalk.cyanBright(config.functions?.length ?? 0)} functions(s)`);
    return config;
  }

  config.entities = config.entities || [];
  config.actions = config.actions || [];
  config.functions = config.functions || [];
  return config;
}

function saveConfig(
  config: DataverseGenOptions,
  updates: {
    entities: number;
    actions: number;
    functions: number;
  },
): void {
  const updateMade = updates.entities + updates.actions + updates.functions > 0;
  if (updateMade) {
    console.log(chalk.green("\n\nConfiguration updated:"));
    console.log(`${chalk.cyanBright(updates.entities)} entities(s) added`);
    console.log(`${chalk.cyanBright(updates.actions)} actions(s) added`);
    console.log(`${chalk.cyanBright(updates.functions)} functions(s) added`);
  } else {
    console.log(chalk.yellow("No items added to configuration"));
  }

  if (updateMade) {
    const configPath = path.join(projectDir, configFileName);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}

function help(): void {
  console.log("  dataverse-gen init  : Adds .dataverse-gen.json config file to your project");
  console.log("  dataverse-gen eject : Adds the templates to your project to allow you to customize them!");
}

async function init(): Promise<void> {
  const pathToTemplate = path.resolve(packageDir, "../.dataverse-gen.template.json");
  const pathToOutput = path.resolve(projectDir, configFileName);

  initDataverseGenConfig(pathToOutput, pathToTemplate);

  const server = await selectServer();
  if (server) {
    // Load EDMX
    const metadataService = new DataverseMetadataService();
    await metadataService.authorize("https://" + server);

    // Load existing config (if there is one)
    const currentConfig = readConfig();
    const updates = await updateConfig(currentConfig, metadataService);

    saveConfig(currentConfig, updates);

    if (await generateNow()) {
      await generate(server);
    }
  }
}

async function updateConfig(currentConfig: DataverseGenOptions, metadataService: MetadataService) {
  const responses = await chooseTypesToGenerate(metadataService, currentConfig);

  const updates = {
    entities: 0,
    actions: 0,
    functions: 0,
  };

  // Set entities
  for (const entity of responses.entities) {
    if (currentConfig.entities?.indexOf(entity) === -1) {
      currentConfig.entities.push(entity);
      updates.entities++;
    }
  }
  // Set actions
  for (const action of responses.actions) {
    if (currentConfig.actions?.indexOf(action) === -1) {
      currentConfig.actions.push(action);
      updates.actions++;
    }
  }
  // Set functions
  for (const functionItem of responses.functions) {
    if (currentConfig.functions?.indexOf(functionItem) === -1) {
      currentConfig.functions.push(functionItem);
      updates.functions++;
    }
  }
  return updates;
}

async function generateNow(): Promise<boolean> {
  return (
    await Enquirer.prompt<{ generate: boolean }>({
      name: "generate",
      type: "confirm",
      message: "Would you like to generate the types now?",
    })
  ).generate;
}

async function getSchema(metadataService: MetadataService) {
  const schema = new SchemaModel(metadataService);
  await schema.loadEdmxMetadata();
  const entities = schema.EntityTypes.map((e) => e.Name);
  const actions = schema.Actions.map((e) => e.Name);
  const functions = schema.Functions.map((e) => e.Name);
  return { entities, actions, functions };
}

async function chooseTypesToGenerate(metadataService: MetadataService, config: DataverseGenOptions) {
  const schema = await getSchema(metadataService);
  const questionInfo = "[type to filter list, space to select]";
  const footerMessage = chalk.whiteBright("[Space - Select] [Return Accept] [Scroll up and down to see more]");
  // Ask for entities
  return await Enquirer.prompt<{ entities: string[]; actions: string[]; functions: string[] }>([
    {
      name: "entities",
      type: "autocomplete",
      message: "Select entities to include " + questionInfo,
      multiple: true,
      limit: 10,
      footer() {
        return footerMessage;
      },
      choices: schema.entities,
      initial: config.entities,
    },
    {
      name: "actions",
      type: "autocomplete",
      message: "Select actions to include " + questionInfo,
      multiple: true,
      limit: 10,
      footer() {
        return footerMessage;
      },
      choices: schema.actions,
      initial: config.actions,
    },
    {
      name: "functions",
      type: "autocomplete",
      message: "Select functions to include " + questionInfo,
      multiple: true,
      limit: 10,
      footer() {
        return footerMessage;
      },
      choices: schema.functions,
      initial: config.functions,
    },
  ] as never);
}

function initDataverseGenConfig(pathToOutput: string, pathToTemplate: string) {
  if (!fs.existsSync(pathToOutput)) {
    console.log(`Initializing project with: ${pathToOutput}`);
    fs.copyFileSync(pathToTemplate, pathToOutput);
  } else {
    console.log(`dataverse-gen.json config already added: ${pathToOutput}`);
  }
}

function eject(): void {
  const config: DataverseGenOptions = readConfig();
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
  const selectedServer = server || (await selectServer());
  const config: DataverseGenOptions = readConfig();
  if (selectedServer) {
    const metadataService = new DataverseMetadataService();
    await metadataService.authorize("https://" + selectedServer);
    const codeWriter = new FileSystemCodeWriter(config);
    const templateProvider = new FileSystemTemplateProvider(config);
    const model = new SchemaModel(metadataService, config);
    await model.generate();
    const codeGenerator = new TypescriptGenerator(model, codeWriter, templateProvider, config);
    await codeGenerator.generate();
  }
}

async function selectServer(): Promise<string | undefined> {
  // Pick the auth server to use
  const authConfig = getAllUsers();
  console.log(chalk.blue("Run 'npx dataverse-auth' to add a new Microsoft Dataverse environment"));
  if (authConfig.length === 0) {
    console.log("No server auth tokens found.");
    return undefined;
  }
  let i = 1;
  const serverNames: string[] = [];
  for (const profile of authConfig) {
    console.log(` (${i})  ${profile.environment} ${profile.userName}`);
    serverNames.push(profile.environment);
    i++;
  }
  const prompt = await Enquirer.prompt<{ number: number }>({
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
  } as never);

  const server = serverNames[prompt.number - 1];
  console.log(`Using server: ${server}`);
  return server;
}

async function main(): Promise<void> {
  // Load config
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

main().then(
  () => {
    console.log(chalk.green("\nComplete!"));
  },
  (ex) => {
    if (ex.message) {
      console.log(chalk.red(`\nError:${ex.message}`));
      console.log(`Stack:${ex.stack}`);
      console.log(JSON.stringify(ex));
    }
  },
);
