import * as fs from "fs";
import "dotenv/config";

import { getMdFileList } from "./lib.js";
import { translateMDFile } from "./aiTranslatorZH.js";
import { gcpTranslator } from "./gcpTranslator.js";
import { createGlossaryMatcher } from "./glossary.js";
import { loadVariables, variablesReplace } from "./variables.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const copyable = /{{< copyable\s+(.+)\s+>}}\r?\n/g;
const replaceDeprecatedContent = (path) => {
  const mdFileContent = fs.readFileSync(path).toString();
  fs.writeFileSync(path, mdFileContent.replace(copyable, ""));
};

const main = async () => {
  const srcList = getMdFileList("markdowns");
  const glossaryMatcher = await createGlossaryMatcher();
  // Load variables from variables.json
  const variables = loadVariables();
  console.log("Loaded variables:", variables);

  for (let filePath of srcList) {
    console.log(filePath);
    variablesReplace(variables, filePath);
    replaceDeprecatedContent(filePath);
    try {
      await translateMDFile(filePath, glossaryMatcher);
    } catch (e) {
      // await gcpTranslator(filePath);
      console.error(e);
    }
  }
};

main();
