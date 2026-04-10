import * as fs from "fs";
import _ from "lodash";
import path from "path";
import { glob } from "glob";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkHtml from "remark-html";
import rehypeRaw from "rehype-raw";

import { toHast } from "mdast-util-to-hast";
import rehypeStringify from "rehype-stringify";

// import { mdxFromMarkdown, mdxToMarkdown } from 'mdast-util-mdx';
import {
  frontmatterFromMarkdown,
  frontmatterToMarkdown,
} from "mdast-util-frontmatter";
import { gfmTableFromMarkdown, gfmTableToMarkdown } from "mdast-util-gfm-table";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";

import { toMarkdown } from "mdast-util-to-markdown";

import { translateSingleText } from "./gcpTranslate.js";
import {
  createComponentPlaceholderHtml,
  createLinkPlaceholderHtml,
  restorePreservedPlaceholders,
} from "./placeholderUtils.js";

const generateNoTranslateTag = (src) => {
  // Use the final placeholder marker in the body so we can still restore even if
  // the translation engine drops the wrapper tag.
  return `<span translate="no">{{B-PLACEHOLDER-${src}-PLACEHOLDER-E}}</span>`;
};

const COMPONENT_LIKE_HTML_TAG = /^<\/?[A-Z][A-Za-z0-9]*(\s|>|\/>)/;
const CUSTOM_CONTENT_OPEN_RE = /^<CustomContent\b[^>]*>\s*$/;
const CUSTOM_CONTENT_CLOSE_RE = /^<\/CustomContent>\s*$/;
const GITHUB_ISSUE_OR_PULL_URL_RE =
  /^https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:issues|pull)\/\d+\/?$/;
const GITHUB_USER_URL_RE = /^https?:\/\/github\.com\/[^/\s]+\/?$/;
const ISSUE_LINK_TEXT_RE = /^#\d+$/;

const shouldPreserveInlineHtmlNode = (value = "") => {
  return COMPONENT_LIKE_HTML_TAG.test(value.trim());
};

const isCustomContentOpenNode = (node) =>
  node?.type === "html" && CUSTOM_CONTENT_OPEN_RE.test(node.value.trim());

const isCustomContentCloseNode = (node) =>
  node?.type === "html" && CUSTOM_CONTENT_CLOSE_RE.test(node.value.trim());

const getPlainNodeText = (node) => {
  if (!node) {
    return "";
  }

  if (typeof node.value === "string") {
    return node.value;
  }

  if (Array.isArray(node.children)) {
    return node.children.map((child) => getPlainNodeText(child)).join("");
  }

  return "";
};

const sourceNodeEndsWithWhitespace = (node) =>
  /\s$/.test(getPlainNodeText(node));

const isGithubIssueOrPullLink = (node, hrefValue) => {
  const linkText = getPlainNodeText(node).trim();
  return (
    node?.type === "link" &&
    ISSUE_LINK_TEXT_RE.test(linkText) &&
    GITHUB_ISSUE_OR_PULL_URL_RE.test(hrefValue)
  );
};

const isGithubUserLink = (node) =>
  node?.type === "link" && GITHUB_USER_URL_RE.test(node.url || "");

const isTrailingGithubMetadata = (children, startIndex) => {
  for (let idx = startIndex + 1; idx < children.length; idx++) {
    const child = children[idx];

    if (child.type === "text" && /^[\s@]*$/.test(child.value)) {
      continue;
    }

    if (isGithubUserLink(child)) {
      continue;
    }

    return false;
  }

  return true;
};

const shouldRestoreLeadingSpaceBeforeIssueLink = (
  children,
  index,
  hrefValue
) =>
  sourceNodeEndsWithWhitespace(children[index - 1]) &&
  isGithubIssueOrPullLink(children[index], hrefValue) &&
  isTrailingGithubMetadata(children, index);

const getMds = (src) => {
  return glob.sync(src + "/**/*.md");
};

export const getMdFileList = (inputDir, outputDir = "output") => {
  const filePaths = getMds(inputDir);
  return filePaths.map((filePath) => {
    // Get relative path from inputDir
    const relativePath = path.relative(inputDir, filePath);
    // Generate output path by joining outputDir with relative path
    const outputFilePath = path.join(outputDir, relativePath);
    return {
      filePath,
      outputFilePath,
    };
  });
};

export const writeFileSync = (destPath, fileContent) => {
  const dir = path.dirname(destPath);

  if (!fs.existsSync(dir)) {
    // console.info(`Create empty dir: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(destPath, fileContent);
};

// heading
// paragraph
// thematicBreak
// blockquote
// list
// listItem
// table
// tableRow
// tableCell
// html
// code
// yaml
// definition
// footnoteDefinition
// text
// emphasis
// strong
// delete
// inlineCode
// break
// link
// image
// linkReference
// imageReference
// footnote
// footnoteReference

export const handleAstNode = (node) => {
  switch (node.type) {
    case "heading":
      return handleHeadings(node);
      break;
    case "paragraph":
      return handleParagraph(node);
      break;
    case "tableCell":
      return handleParagraph(node);
      break;
    case "html":
      return handleHTML(node);
    case "yaml":
      return handleFrontMatter(node);
    default:
      // console.log(node);
      break;
  }
};

// docs {
//   sum: 217507,
//   yaml: 802,
//   heading: 6984,
//   paragraph: 34051,
//   html: 2765,
//   list: 5623,
//   text: 82235,
//   strong: 1984,
//   listItem: 22692,
//   link: 11261,
//   inlineCode: 27295,
//   table: 429,
//   tableRow: 3703,
//   tableCell: 11292,
//   code: 4027,
//   blockquote: 790,
//   emphasis: 130,
//   image: 551,
//   definition: 50,
//   linkReference: 39,
//   thematicBreak: 1
// }

// docs paragraph {
//   sum: 34051,
//   text: 52747,
//   strong: 1954,
//   link: 10259,
//   inlineCode: 22869,
//   emphasis: 89,
//   image: 551,
//   html: 133,

//   linkReference: 3
// {type: 'linkReference', children: Array(1), position: {…}, label: 'RFC 4180', identifier: 'rfc 4180', …}
// children:(1) [{…}]
// identifier:'rfc 4180'
// label:'RFC 4180'
// position:{start: {…}, end: {…}}
// referenceType:'shortcut'
// type:'linkReference'

// }

const handleFrontMatter = async (yamlNode) => {
  const originVal = yamlNode.value;
  const originValList = originVal.split("\n");
  const result = [];
  for (let i = 0; i < originValList.length; i++) {
    const frontmatterItem = originValList[i];
    const keyName = frontmatterItem.split(":").shift();
    // if (keyName === "title") {
    //   const itemVal = frontmatterItem.split("title:").pop();
    //   const translatedVal = await translateSingleText(itemVal);
    //   result.push(`title: ${translatedVal}`);
    // } else if (keyName === "summary") {
    if (keyName === "summary") {
      const itemVal = frontmatterItem.split("summary:").pop();
      const [translatedVal] = await translateSingleText(itemVal);
      if (translatedVal) {
        result.push(`summary: ${translatedVal.replace("`", "")}`);
      }
    } else {
      result.push(frontmatterItem);
    }
  }
  yamlNode.value = result.join("\n");
};

const handleHTML = async (htmlNode) => {
  const HTMLStr = htmlNode.value;
  if (shouldPreserveInlineHtmlNode(HTMLStr)) {
    return;
  }
  if (
    !HTMLStr.includes(`<span translate="no">`) &&
    // GCP Glossary will be missing in the title content
    !HTMLStr.includes('title="')
  ) {
    const [output] = await translateSingleText(HTMLStr, "text/html");
    htmlNode.value = output;
  }
};

const handleParagraph = async (paragraphNode) => {
  paragraphNode.children = await translatePhrasingChildren(paragraphNode.children);
};

export const translatePhrasingChildren = async (
  children,
  translateText = translateSingleText
) => {
  const metadata = await paragraphIntegratePlaceholder(children, translateText);
  const HTMLStr = await phrasingChildrenToTranslationHtml(children);
  const [output] = await translateText(HTMLStr, "text/html");
  const translatedHTMLStr = restorePreservedPlaceholders(output);
  const translatedHTMLStrWithBr = updateBrTag(
    inlineHtml2mdStr(translatedHTMLStr)
  );
  return retriveByPlaceholder(translatedHTMLStrWithBr, metadata);
};

const findMatchingCustomContentClose = (children, openIndex) => {
  let depth = 0;

  for (let idx = openIndex; idx < children.length; idx++) {
    const child = children[idx];
    if (isCustomContentOpenNode(child)) {
      depth++;
      continue;
    }

    if (!isCustomContentCloseNode(child)) {
      continue;
    }

    depth--;
    if (depth === 0) {
      return idx;
    }
  }

  return -1;
};

const createPlaceholderNode = (value) => ({
  type: "html",
  value,
});

const getMetaNodePayload = (metaEntry) => {
  if (!metaEntry) {
    return [];
  }

  if (metaEntry.kind === "node-group") {
    return _.cloneDeep(metaEntry.nodes || []);
  }

  if (metaEntry.node) {
    return [_.cloneDeep(metaEntry.node)];
  }

  return [];
};

const restoredNodeEndsWithWhitespace = (node) =>
  typeof node?.value === "string" && /\s$/.test(node.value);

const addLeadingSpaceIfNeeded = (outputNodes, metaEntry) => {
  if (
    !metaEntry?.restoreLeadingSpaceIfJoined ||
    !outputNodes.length ||
    restoredNodeEndsWithWhitespace(outputNodes[outputNodes.length - 1])
  ) {
    return;
  }

  outputNodes.push({
    type: "html",
    value: " ",
  });
};

const createMetadataEntry = (meta, metaEntry, nextId) => {
  meta[nextId] = metaEntry;
  return nextId;
};

const phrasingChildrenToTranslationHtml = async (children) => {
  const paragraphHtml = await mdSnippet2html({
    type: "paragraph",
    children,
  });
  const trimParagraphHtml = trimHtmlTags(paragraphHtml);
  return updateHTMLNoTransStr(trimParagraphHtml);
};

const paragraphIntegratePlaceholder = async (children, translateText) => {
  // type PhrasingContent = HTML | Link | LinkReference | Text | Emphasis | Strong | Delete | InlineCode | Break | Image | ImageReference | Footnote | FootnoteReference
  const meta = {};
  let nextPlaceholderId = 0;

  for (let idx = 0; idx < children.length; idx++) {
    const child = children[idx];

    if (isCustomContentOpenNode(child)) {
      const closeIndex = findMatchingCustomContentClose(children, idx);
      if (closeIndex !== -1) {
        const placeholderId = createMetadataEntry(
          meta,
          {
            kind: "node-group",
            nodes: [],
          },
          nextPlaceholderId++
        );
        const innerChildren = _.cloneDeep(children.slice(idx + 1, closeIndex));
        const translatedInnerChildren = await translatePhrasingChildren(
          innerChildren,
          translateText
        );
        const componentNodes = [
          _.cloneDeep(child),
          ...translatedInnerChildren,
          _.cloneDeep(children[closeIndex]),
        ];
        const componentInnerHtml = await phrasingChildrenToTranslationHtml(
          translatedInnerChildren
        );

        meta[placeholderId].nodes = componentNodes;
        children.splice(
          idx,
          closeIndex - idx + 1,
          createPlaceholderNode(
            createComponentPlaceholderHtml(placeholderId, componentInnerHtml)
          )
        );
        continue;
      }
    }

    switch (child.type) {
      case "link":
        const linkPlaceholderId = nextPlaceholderId++;
        const linkHtml = await mdSnippet2html(child);
        const linkHtmlStr = trimHtmlTags(linkHtml);
        const hrefValue = linkHtmlStr.match(
          /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/
        )[2];
        const restoreLeadingSpaceIfJoined =
          shouldRestoreLeadingSpaceBeforeIssueLink(children, idx, hrefValue);
        const [linkHtmlStrInside] = await translateText(
          trimHtmlTags(linkHtmlStr),
          "text/html"
        );
        const translatedLinkText = inlineHtml2mdStr(linkHtmlStrInside);
        children[idx] = createPlaceholderNode(
          createLinkPlaceholderHtml(
            linkPlaceholderId,
            hrefValue,
            translatedLinkText
          )
        );
        meta[linkPlaceholderId] = {
          kind: "link",
          restoreLeadingSpaceIfJoined,
          node: {
            type: "html",
            value: `[${translatedLinkText}](${hrefValue})`,
          },
        };
        break;
      case "linkReference":
      case "inlineCode":
      case "image":
      case "imageReference":
      case "footnote":
      case "footnoteReference":
        const nodePlaceholderId = nextPlaceholderId++;
        const nodeChildCopy = _.cloneDeep(child);
        children[idx] = createPlaceholderNode(
          generateNoTranslateTag(nodePlaceholderId)
        );
        meta[nodePlaceholderId] = {
          kind: "node",
          node: nodeChildCopy,
        };
        break;
      case "html":
        if (!shouldPreserveInlineHtmlNode(child.value)) {
          break;
        }
        const htmlPlaceholderId = nextPlaceholderId++;
        const htmlChildCopy = _.cloneDeep(child);
        children[idx] = createPlaceholderNode(
          generateNoTranslateTag(htmlPlaceholderId)
        );
        meta[htmlPlaceholderId] = {
          kind: "node",
          node: htmlChildCopy,
        };
        break;
      default:
        break;
    }
  }
  return meta;
};

const retriveByPlaceholder = (resultStr, meta) => {
  return resultStr
    .split(/(\{\{B-PLACEHOLDER-\d+-PLACEHOLDER-E\}\})/g)
    .reduce((prev, item) => {
      if (!item) {
        return prev;
      }

      const placeholderMatch = item.match(
        /^\{\{B-PLACEHOLDER-(\d+)-PLACEHOLDER-E\}\}$/
      );
      if (placeholderMatch) {
        const metaEntry = meta[parseInt(placeholderMatch[1], 10)];
        addLeadingSpaceIfNeeded(prev, metaEntry);
        prev.push(...getMetaNodePayload(metaEntry));
        return prev;
      }

      prev.push({
        type: "html",
        value: item,
      });

      return prev;
    }, []);
};

const enStr2AnchorFormat = (headingStr) => {
  // trim spaces and transform characters to lower case
  const text = headingStr.trim().toLowerCase();
  // \W is the negation of shorthand \w for [A-Za-z0-9_] word characters (including the underscore)
  const result = text.replace(/[\W_]+/g, "-").replace(/^-+|-+$/g, "");
  return result;
};

const headingTextExactCustomId = async (headingNode) => {
  const headingHtml = await mdSnippet2html(headingNode);
  const headingStr = trimHtmlTags(headingHtml);
  headingNode.HTMLStr = headingStr;
  const customIdRegex = /{#.+}$/;
  // Ignore if already has a custom id
  if (customIdRegex.test(headingStr)) {
    const customIdStr = /{#(.+)}$/.exec(headingStr)[1];
    headingNode.customId = customIdStr;
    return;
  }
  headingNode.customId = enStr2AnchorFormat(headingStr);
};

const concatHeadingCustomId = async (headingNode) => {
  const children = headingNode?.children || [];
  const child = children?.[0];
  const customId = headingNode?.customId;
  if (customId) {
    child.value = `${child.value} {#${customId}}`;
  }
};

const handleHeadings = async (node) => {
  await headingTextExactCustomId(node);
  const HTMLStr = node.HTMLStr;
  const [translatedHTMLStr] = await translateSingleText(HTMLStr, "text/html");
  node.children = [
    {
      type: "html",
      value: translatedHTMLStr,
    },
  ];
  await concatHeadingCustomId(node);
};

const mdSnippet2html = async (mdNode) => {
  const mdStr = astNode2mdStr(mdNode);
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    // .use(remarkRehype)
    // .use(remarkHtml)
    .use(rehypeStringify)
    .process(mdStr);

  return result.value;
};

const astNode2mdStr = (astNode) => {
  const result = toMarkdown(astNode, {
    bullet: "-",
    extensions: [
      frontmatterToMarkdown(["yaml", "toml"]),
      // gfmTableToMarkdown(),
      gfmToMarkdown(),
    ],
  });
  // const result = newFile.replaceAll(/(#+.+)(\\{)(#.+})/g, `$1{$3`);
  return result;
};

const trimHtmlTags = (htmlStr) => {
  // src: <h1>TiDB Experimental Features <em>a</em> <strong>b</strong> ~~c~~ <code>d</code> 123456 </h1>
  // result: TiDB Experimental Features <em>a</em> <strong>b</strong> ~~c~~ <code>d</code> 123456
  const originHtmlStr = htmlStr.trim();
  if (originHtmlStr.startsWith("<li>")) {
    return originHtmlStr;
  }
  const htmlStrWithoutTags = originHtmlStr
    .replace(/^<[^>]+>/, "")
    .replace(/<\/[^>]+>$/, "")
    .replace(`<p>`, ``)
    .replace(`</p>`, ``)
    .trim();
  return htmlStrWithoutTags;
};

const inlineHtml2mdStr = (HTMLStr = "") => {
  // type PhrasingContent = Text | Emphasis | Strong | Delete | InlineCode | Break
  return HTMLStr.replaceAll(`<strong>`, `**`)
    .replaceAll(`</strong>`, `**`)
    .replaceAll(`<code>`, "`")
    .replaceAll(`</code>`, "`")
    .replaceAll(`<em>`, `*`)
    .replaceAll(`</em>`, `*`)
    .replaceAll(`<del>`, `~~`)
    .replaceAll(`</del>`, `~~`)
    .replaceAll(`<p>`, ``)
    .replaceAll(`</p>`, ``);
};

const updateHTMLNoTransStr = (HTMLStr) => {
  // {{B-NOTRANSLATE-${src}-NOTRANSLATE-E}}
  // return HTMLStr.replaceAll(
  //   `{{B-NOTRANSLATE-`,
  //   `<span translate="no">`
  // ).replaceAll(`-NOTRANSLATE-E}}`, `</span>`);
  return HTMLStr.replaceAll(`{{B-NOTRANSLATE-`, ``).replaceAll(
    `-NOTRANSLATE-E}}`,
    ``
  );
};

// Gatsby will raise SyntaxError: unknown: Expected corresponding JSX closing tag for <br>.
const updateBrTag = (src) => {
  return src.replaceAll(`<br>`, `<br/>`);
};
