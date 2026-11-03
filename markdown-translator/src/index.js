import * as fs from "fs";
import "dotenv/config";

import { getMdFileList } from "./lib.js";
import { translateMDFile } from "./aiTranslatorZH.js";
import { createGlossaryMatcher } from "./glossary.js";
import { loadVariables, variablesReplace } from "./variables.js";
import { postProcessFileFrontmatterAliases } from "./frontmatterAliases.js";

const copyable = /{{< copyable\s+(.+)\s+>}}\r?\n/g;
const replaceDeprecatedContent = (path) => {
  const mdFileContent = fs.readFileSync(path).toString();
  fs.writeFileSync(path, mdFileContent.replace(copyable, ""));
};

const main = async (dir = "markdowns", outputDir = "output") => {
  const srcList = getMdFileList(dir, outputDir);
  const glossaryMatcher = await createGlossaryMatcher(
    "https://raw.githubusercontent.com/pingcap/docs/refs/heads/master/resources/terms.md"
  );
  // Load variables from variables.json
  const variables = loadVariables(dir);
  console.log("Loaded variables:", variables);

  for (let { filePath, outputFilePath } of srcList) {
    console.log(filePath);
    variablesReplace(variables, filePath);
    replaceDeprecatedContent(filePath);
    try {
      await translateMDFile(filePath, glossaryMatcher, outputFilePath);
      postProcessFileFrontmatterAliases(outputFilePath, "zh");
    } catch (e) {
      // await gcpTranslator(filePath, outputFilePath);
      console.error(e);
    }
  }
};

// Parse command line arguments
const getInputDir = () => {
  const inputIndex = process.argv.indexOf("--input-dir");
  if (inputIndex !== -1 && process.argv[inputIndex + 1]) {
    return process.argv[inputIndex + 1];
  }
  return "markdowns";
};

const getOutputDir = () => {
  const outputIndex = process.argv.indexOf("--output-dir");
  if (outputIndex !== -1 && process.argv[outputIndex + 1]) {
    return process.argv[outputIndex + 1];
  }
  return "output";
};

const dir = getInputDir();
const outputDir = getOutputDir();
main(dir, outputDir);
