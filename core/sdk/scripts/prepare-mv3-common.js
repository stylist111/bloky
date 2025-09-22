import fs from "fs";
import {promisify} from "util";
import {exec} from "child_process";
import path from "path";

import {readFile} from "./utils.js";

async function writeCustomMV3Subscriptions(inputFile, scriptsOutputDir) {
  let data = await readFile(inputFile);
  let text = `const customMV3Subscriptions = ${data.toString()};`;
  await fs.promises.writeFile(path.join(
    scriptsOutputDir, "custom-mv3-subscriptions.js"), text, {encoding: "utf-8"}
  );
}

export async function commonRun(subsInput, scriptsOutputDir) {
  let subsOutput = path.join(scriptsOutputDir, "custom-subscriptions.json");

  console.log(`Building subscriptions and rulesets from ${subsInput}...`);

  let fetchedSubscription = path.join(scriptsOutputDir, "subscriptions");
  let convertedRulesets = path.join(scriptsOutputDir, "rulesets");
  let rulesetsFile = path.join(convertedRulesets, "rulesets.json");
  let arrayOfDefaultEnabledRulesets = ["00000000-0000-0000-0000-000000000030"];

  await promisify(exec)(`npm run subs-merge -- -i ${subsInput} -o ${subsOutput}`);
  await promisify(exec)(`npm run subs-fetch -- -i ${subsOutput} -o ${fetchedSubscription}`);
  await promisify(exec)(`npm run subs-convert -- -i ${fetchedSubscription} -o ${convertedRulesets} -s ${subsOutput}`);
  await promisify(exec)(`npm run subs-generate -- -i ${convertedRulesets} -o ${rulesetsFile} -d ${arrayOfDefaultEnabledRulesets.join(" ")} -p rulesets/`);

  await writeCustomMV3Subscriptions(subsInput, scriptsOutputDir);

  console.log(`✅ Rulesets and subscriptions generated in ${scriptsOutputDir}`);
}
