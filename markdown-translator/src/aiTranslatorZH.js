import * as fs from "fs";
import { get_encoding } from "tiktoken";
import { writeFileSync } from "./lib.js";
import { executeLangLinkTranslator } from "./langlinkClient.js";

// LangLink 配置
const LANGLINK_APP_ID = "b9084183-a95f-4645-97bc-55ce8da9b2ff";

// Token 限制配置
const OUTPUT_TOKEN_LIMIT = 60000;
const TIKTOKEN_ENCODING = "cl100k_base";

// 英文到中文的token比例估算（通常中文token数约为英文的1.5-2倍）
const TOKEN_RATIO = 1.8;
const INPUT_TOKEN_LIMIT = Math.floor(OUTPUT_TOKEN_LIMIT / TOKEN_RATIO);

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

/**
 * 使用LangLink进行翻译
 * @param {string} content - 要翻译的内容
 * @param {Array} glossary - 词汇表
 * @returns {Promise<string>} 翻译结果
 */
const translateWithLangLink = async (content, glossary) => {
  try {
    const result = await executeLangLinkTranslator(
      LANGLINK_APP_ID,
      content,
      glossary
    );
    return result;
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
 */
export const translateMDFile = async (filePath, glossaryMatcher = null) => {
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
      await gcpTranslator(filePath);
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
    writeFileSync(`output/${filePath}`, processedContent);

    console.log(`翻译完成: ${filePath}`);
  } catch (error) {
    console.error(`翻译失败: ${filePath}`, error);
    throw error;
  }
};
