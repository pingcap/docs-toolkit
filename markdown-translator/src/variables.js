import * as fs from "fs";
import path from "path";

function getValueByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : ""), obj) ?? "";
}
const variablePattern = /{{{\s*\.(.+?)\s*}}}/g;

export const loadVariables = () => {
  const variablesPath = path.join("markdowns", "variables.json");
  try {
    const variablesContent = fs.readFileSync(variablesPath, "utf8");
    return JSON.parse(variablesContent);
  } catch (error) {
    console.warn(
      `Warning: Could not load variables from ${variablesPath}:`,
      error.message
    );
    return {};
  }
};

export const variablesReplace = (variables, filePath) => {
  // Read the file content
  const fileContent = fs.readFileSync(filePath, "utf8");

  // Replace variables in the content
  const processedContent = fileContent.replace(
    variablePattern,
    (match, path) => {
      const value = getValueByPath(variables, path.trim());
      if (value) {
        return String(value);
      }
      return match;
    }
  );

  fs.writeFileSync(filePath, processedContent);
};
