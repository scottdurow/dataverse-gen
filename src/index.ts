#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-use-before-define */
process.env.SUPPRESS_NO_CONFIG_WARNING = "true";
import chalk from "chalk";
import { getAllUsers } from "dataverse-ify/lib/webapi/node/MsalAuth";
import Enquirer from "enquirer";
import * as fs from "fs-extra";
import * as path from "path";
import { FileSystemCodeWriter } from "./CodeWriter";
import { DataverseGenArgs, DataverseGenCommands } from "./DataverseGenArgs";
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
    console.log(chalk.white("Loading config: " + configPath));
    const configJSON = fs.readFileSync(configPath).toString();
    const config: DataverseGenOptions = JSON.parse(configJSON) as DataverseGenOptions;
    console.log(`${chalk.white.dim(JSON.stringify(config))}`);
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
  // Always update file to add options
  const configPath = path.join(projectDir, configFileName);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function GetMetadataService(args: DataverseGenArgs): Promise<DataverseMetadataService> {
  const metadataService = new DataverseMetadataService();
  if (args.environmentUrl && args.applicationId && args.tenantId && args.clientSecret) {
    console.log(chalk.yellow("Using Client Secret Auth"));
    await metadataService.authorize(args.environmentUrl, args.tenantId, args.applicationId, args.clientSecret);
  } else if (args.environmentUrl) {
    await metadataService.authorize(args.environmentUrl);
  } else {
    const server = await selectServer();
    args.environmentUrl = "https://" + server;
    await metadataService.authorize(args.environmentUrl);
  }
  return metadataService;
}

async function init(args: DataverseGenArgs): Promise<void> {
  const pathToTemplate = path.resolve(packageDir, "../.dataverse-gen.template.json");
  const pathToOutput = path.resolve(projectDir, configFileName);

  initDataverseGenConfig(pathToOutput, pathToTemplate);

  // Load EDMX
  const metadataService = await GetMetadataService(args);

  // Load existing config (if there is one)
  const currentConfig = readConfig();
  const updates = await updateConfig(currentConfig, metadataService);

  saveConfig(currentConfig, updates);

  if (await generateNow()) {
    await generate(args);
  }
}

async function updateConfig(currentConfig: DataverseGenOptions, metadataService: MetadataService) {
  await chooseOptions(currentConfig);
  const updates = {
    entities: 0,
    actions: 0,
    functions: 0,
  };

  if (!currentConfig.generateEntityTypes && !currentConfig.generateFormContext) {
    currentConfig.entities = [];
    currentConfig.actions = [];
    currentConfig.functions = [];
    return updates;
  }

  const responses = await chooseTypesToGenerate(metadataService, currentConfig);

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
  const entities = schema.EntityTypes.filter((e) => e.EntitySetName).map((e) => e.Name);
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

async function chooseOptions(currentConfig: DataverseGenOptions): Promise<void> {
  const option = await Enquirer.prompt<DataverseGenOptions>([
    {
      name: "generateFormContext",
      type: "confirm",
      message: "Generate form context helpers?",
    },
    {
      name: "generateEntityTypes",
      type: "confirm",
      message: "Generate dataverse-ify entity types?",
    },
  ]);

  currentConfig.generateFormContext = option.generateFormContext === true;
  currentConfig.generateEntityTypes = option.generateEntityTypes === true;
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

async function generate(args: DataverseGenArgs): Promise<void> {
  const metadataService = args.connectedService || (await GetMetadataService(args));
  const config: DataverseGenOptions = readConfig();
  const codeWriter = new FileSystemCodeWriter(config);
  const templateProvider = new FileSystemTemplateProvider(config);
  const model = new SchemaModel(metadataService, config);
  await model.generate();
  const codeGenerator = new TypescriptGenerator(model, codeWriter, templateProvider, config);
  await codeGenerator.generate();
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

  const args = new DataverseGenArgs(process.argv.slice(2));
  switch (args.command) {
    case DataverseGenCommands.Help:
      args.outputHelp();
      break;
    case DataverseGenCommands.Init:
      await init(args);
      break;
    case DataverseGenCommands.Eject:
      eject();
      break;
    default:
      await generate(args);
      break;
  }
}

main().then(
  () => {
    console.log(chalk.green("\nComplete!"));
  },
  (ex) => {
    const message = ex.message || ex;

    console.log(chalk.red(`\nError:${message}`));
    if (ex.stack) {
      console.log(`Stack:${ex.stack}`);
      console.log(JSON.stringify(ex));
    }
  },
);
