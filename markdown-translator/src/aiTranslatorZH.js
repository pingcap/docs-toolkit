import * as fs from "fs";
import OpenAI from "openai";
import { get_encoding } from "tiktoken";
import { writeFileSync } from "./lib.js";
import { gcpTranslator } from "./gcpTranslator.js";

// Token 限制配置
const OUTPUT_TOKEN_LIMIT = 60000;
const TIKTOKEN_ENCODING = "cl100k_base";

// 英文到中文的token比例估算（通常中文token数约为英文的1.5-2倍）
const TOKEN_RATIO = 1.8;
const INPUT_TOKEN_LIMIT = Math.floor(OUTPUT_TOKEN_LIMIT / TOKEN_RATIO);

const getOpenAIConfig = () => ({
  baseURL: process.env.OPENAI_RESPONSES_API_URL,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || "gpt-5.4",
});

let openAIClient;
let openAIClientCacheKey;

const getOpenAIClient = ({ baseURL, apiKey }) => {
  const cacheKey = `${baseURL}::${apiKey}`;
  if (!openAIClient || openAIClientCacheKey !== cacheKey) {
    openAIClient = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: {
        "api-key": apiKey,
      },
    });
    openAIClientCacheKey = cacheKey;
  }

  return openAIClient;
};

/**
 * 计算文本的token数量
 * @param {string} text - 要计算的文本
 * @returns {number} token数量
 */
const countTokens = (text) => {
  const enc = get_encoding(TIKTOKEN_ENCODING);
  const tokens = enc.encode(text);
  const count = tokens.length;
  enc.free();
  return count;
};

const buildTranslationPrompt = (content, glossary) => `You are a professional technical document translator, specializing in translating English technical documents into accurate and professional Chinese.

Please translate the following English technical document into Chinese, preserving the original Markdown format and structure:

English Content:
${content}

Please follow these requirements strictly:

Markdown and Code Preservation Rules:
- Absolutely preserve all Markdown structures (headings, lists, tables, links, emphasis, etc.).
- Preserve ALL code blocks exactly as-is:
    - Do not modify code.
     - Do not summarize, shorten, or replace it with comments like “代码保持不变”.
     - Do not add or remove any characters inside code blocks.
     - Treat everything between triple backticks \`\`\` as literal text to copy verbatim.
- Keep all filenames, paths, SQL, Java, Go, JSON, YAML, and shell commands unchanged.
 
Translation Rules:
- Use precise, professional Chinese technical terminology.
- Maintain logical flow and readability.
- Keep all link URLs unchanged.
- Do not translate text wrapped in bold syntax.
- Translate “you” as “你”, not “您”.
- Insert spaces between Chinese and English text, and between Chinese text and Arabic numerals.
- Translate only the natural-language content. Do not add explanations or extra text.

Strictly forbidden:
- Do not omit code blocks.
- Do not replace code with placeholders.
- Do not rewrite or format code.
- Do not hallucinate missing content.
- Do not simplify long code samples.

Glossary Rules:
If you find any of the following keys in the text, do not translate them; simply replace the matching key with the corresponding value:
${JSON.stringify(glossary, null, 2)}`;

const extractResponseText = (responseBody) => {
  if (typeof responseBody.output_text === "string" && responseBody.output_text) {
    return responseBody.output_text;
  }

  if (!Array.isArray(responseBody.output)) {
    throw new Error(`Unexpected OpenAI response shape: ${JSON.stringify(responseBody)}`);
  }

  const text = responseBody.output
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text || "")
    .join("");

  if (!text) {
    throw new Error(`OpenAI response does not contain output text: ${JSON.stringify(responseBody)}`);
  }

  return text;
};

/**
 * 使用 OpenAI Responses API 进行翻译
 * @param {string} content - 要翻译的内容
 * @param {Record<string, string>} glossary - 词汇表
 * @returns {Promise<string>} 翻译结果
 */
const translateWithLangLink = async (content, glossary) => {
  const { baseURL, apiKey, model } = getOpenAIConfig();

  if (!baseURL || !apiKey || !model) {
    throw new Error("Missing required env vars: OPENAI_RESPONSES_API_URL, OPENAI_API_KEY");
  }

  try {
    const client = getOpenAIClient({ baseURL, apiKey });
    const response = await client.responses.create({
      model,
      input: buildTranslationPrompt(content, glossary),
      max_output_tokens: OUTPUT_TOKEN_LIMIT,
    });

    return extractResponseText(response);
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

/**
 * 处理 meta 信息，确保 summary 被双引号包裹
 * @param {string} content - 文件内容
 * @returns {string} 处理后的内容
 */
const processMetaInfo = (content) => {
  const metaRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(metaRegex);

  if (!match) {
    return content;
  }

  const metaContent = match[1];
  const lines = metaContent.split("\n");
  const processedLines = lines.map((line) => {
    if (line.startsWith("summary:")) {
      const summaryValue = line.substring(8).trim();
      // 如果 summary 值以反引号开头，则添加双引号包裹
      if (summaryValue.startsWith("`")) {
        return `summary: "${summaryValue}"`;
      }
    }
    return line;
  });

  const processedMetaContent = processedLines.join("\n");
  return content.replace(metaRegex, `---\n${processedMetaContent}\n---\n`);
};

/**
 * 翻译Markdown文件
 * @param {string} filePath - 文件路径
 * @param {Function} glossaryMatcher - 词汇表匹配器函数
 * @param {string} outputFilePath - 输出文件路径
 */
export const translateMDFile = async (
  filePath,
  glossaryMatcher = null,
  outputFilePath
) => {
  try {
    // 读取文件内容
    const content = fs.readFileSync(filePath).toString();

    // 计算输入token数量
    const inputTokens = countTokens(content);

    // 检查是否超过限制
    if (inputTokens > INPUT_TOKEN_LIMIT) {
      console.log(`跳过翻译: ${filePath}`);
      console.log(
        `原因: 输入token数量 (${inputTokens}) 超过限制 (${INPUT_TOKEN_LIMIT})`
      );
      console.log(`文件大小: ${Math.round(inputTokens * 0.75)} 字符`);
      // 如果超过限制，则使用gcp翻译
      await gcpTranslator(filePath, outputFilePath);
      return;
    }

    console.log(`开始翻译: ${filePath}`);
    console.log(`输入token数量: ${inputTokens}/${INPUT_TOKEN_LIMIT}`);

    // 使用glossaryMatcher生成词汇表
    const glossary = glossaryMatcher ? glossaryMatcher(content) : {};

    // 执行翻译
    const translatedContent = await translateWithLangLink(content, glossary);

    // 处理 meta 信息，确保 summary 被双引号包裹
    const processedContent = processMetaInfo(translatedContent);

    // 写入输出文件
    writeFileSync(outputFilePath, processedContent);

    console.log(`翻译完成: ${filePath}`);
  } catch (error) {
    console.error(`翻译失败: ${filePath}`, error);
    throw error;
  }
};
