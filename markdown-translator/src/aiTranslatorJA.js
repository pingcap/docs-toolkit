import * as fs from "fs";

import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { get_encoding } from "tiktoken";

import { executeLangLinkTranslator } from "./langlinkClient.js";
import { writeFileSync } from "./lib.js";

const GPT35_APP_ID = "1d7dda61-5a41-47c8-a0f1-63547a974214";

const createNewRoot = () => ({ type: "root", children: [] });

export const translateMDFile = async (filePath, glossaryMatcher) => {
  const mdFileContent = fs.readFileSync(filePath).toString();
  const [meta, content] = splitMetaContent(mdFileContent);
  const glossary = glossaryMatcher(content);

  const headings = extractHeadings(content);
  // console.log(headings);
  const contentSegments = contentSplit(content)
    .map((seg) =>
      seg.skip
        ? seg
        : // preserve \n from openai output
          // \n\nabc\nbcd\n -> ['', '', 'abc\nbcd', ''].join('\n')
          seg.content
            .split(/^\n+|\n+$/g)
            .map((c) => ({ content: c, skip: !!c ? seg.skip : true }))
    )
    .flat();

  const dataArr = await Promise.all(
    contentSegments.map((seg) => {
      if (seg.skip) {
        return Promise.resolve(seg.content);
      }
      return executeLangLinkTranslator(GPT35_APP_ID, seg.content, glossary);
    })
  );
  // console.log(dataArr);
  const data = dataArr.join("\n").trim();
  const result = concatHeadings(data, headings);
  const contentWithMeta = `${meta ? `${meta}\n` : ""}${result}`;

  writeFileSync(`output/${filePath}`, contentWithMeta);
};

const metaReg = /---\n/;

const splitMetaContent = (originalText) => {
  const [_, meta, ...content] = originalText.split(metaReg);
  if (!meta) {
    return [undefined, originalText];
  }
  return [`---\n${meta}---\n`, content.join("---\n")];
};

const fromMarkdownContent = (content) =>
  fromMarkdown(content, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

const toMarkdownContent = (astNode) =>
  toMarkdown(astNode, {
    bullet: "-",
    listItemIndent: "one",
    fences: true,
    extensions: [gfmToMarkdown()],
  });

const MAX_TOKEN = 2048;
const TIKTOKEN_ENCODING = "cl100k_base";

const createSegment = (content, skip = false) => ({ content, skip });
const skipTypes = ["code"];
const splitBy = ["heading", "list"];

const willSegmentReachLimit = (segment, newChildren) => {
  const enc = get_encoding(TIKTOKEN_ENCODING);
  const tempSegment = createNewRoot();
  tempSegment.children = [...segment.children, ...newChildren];
  const tempSegmentContent = toMarkdownContent(tempSegment);
  const tempNumTokens = enc.encode(tempSegmentContent).length;
  enc.free();

  return tempNumTokens > MAX_TOKEN;
};

/**
 * 1. Split by heading as segment
 * 2. Re-join segments if under limit
 */
const contentSplit = (content, by = 0) => {
  const enc = get_encoding(TIKTOKEN_ENCODING);
  const numTokens = enc.encode(content).length;
  enc.free();

  if (numTokens < MAX_TOKEN) {
    return [createSegment(content)];
  }

  const splitToken = splitBy[by];
  // group by node type
  const root = fromMarkdownContent(content);
  // { skip: boolean; nodes: Content[] }[]
  const nodeGroup = [];
  // Content[]
  let nodes = [];

  root.children.forEach((node) => {
    if ((node.type === splitToken || !splitToken) && !!nodes.length) {
      nodeGroup.push({ skip: false, nodes });
      nodes = [node];
      return;
    }

    if (skipTypes.includes(node.type)) {
      if (!!nodes.length) {
        nodeGroup.push({ skip: false, nodes });
      }
      nodeGroup.push({ skip: true, nodes: [node] });
      nodes = [];
      return;
    }

    nodes.push(node);
  });
  if (!!nodes.length) {
    nodeGroup.push({ skip: false, nodes });
  }

  // re-join content
  const output = [];
  let segment = createNewRoot();
  const pushSegmentContentToOutput = () => {
    if (!segment.children.length) {
      return;
    }

    const segmentContent = toMarkdownContent(segment);
    const enc = get_encoding(TIKTOKEN_ENCODING);
    const numTokens = enc.encode(segmentContent).length;
    enc.free();
    if (numTokens > MAX_TOKEN) {
      if (!splitToken) {
        console.log(`Too large paragraph:\n${segmentContent.slice(0, 100)}...`);
        // throw new Error(
        //   `Too large paragraph:\n${segmentContent.slice(0, 100)}...`
        // );
      } else {
        output.push(...contentSplit(segmentContent, ++by));
        segment.children = [];
        return;
      }
    }

    output.push(createSegment(segmentContent, numTokens > MAX_TOKEN));
    segment.children = [];
  };

  nodeGroup.forEach((g) => {
    if (g.skip) {
      pushSegmentContentToOutput();
      // insert skip node into output
      const newRoot = createNewRoot();
      newRoot.children = g.nodes;
      output.push(createSegment(toMarkdownContent(newRoot), true));
      return;
    }

    const willReachLimit = willSegmentReachLimit(segment, g.nodes);
    if (willReachLimit) {
      pushSegmentContentToOutput();
    }

    segment.children.push(...g.nodes);
  });
  if (!!segment.children.length) {
    pushSegmentContentToOutput();
  }

  return output;
};

const extractHeadings = (content) => {
  const root = fromMarkdownContent(content);
  return root.children
    .filter((node) => node.type === "heading")
    .map((node) => ({
      level: node.depth,
      content: enStr2AnchorFormat(toMarkdownContent(node)),
    }));
};

const concatHeadings = (content, headings) => {
  const root = fromMarkdownContent(content);
  // console.log(content);
  const contentHeadings = root.children.filter(
    (node) => node.type === "heading"
  );

  // console.log(
  //   contentHeadings.map((h) => ({
  //     level: h.depth,
  //     content: h.children[0].value,
  //   }))
  // );

  headings.forEach((heading, index) => {
    const contentHeading = contentHeadings[index];
    if (!contentHeading) {
      throw new Error(
        `Heading don't match, the heading of origin content is: ${heading.content}`
      );
    }

    if (contentHeading.depth !== heading.level) {
      throw new Error(
        `The wrong level has been matched. Origin heading level: ${heading.level}, text: ${heading.content}; Translated Heading level: ${contentHeading.depth}, text: ${contentHeading.children[0].value}`
      );
    }

    contentHeading.children.push({
      type: "text",
      value: ` {#${heading.content}}`,
    });
  });

  return toMarkdownContent(root);
};

const enStr2AnchorFormat = (headingStr) => {
  // trim spaces and transform characters to lower case
  const text = headingStr.trim().toLowerCase();
  // \W is the negation of shorthand \w for [A-Za-z0-9_] word characters (including the underscore)
  const result = text.replace(/[\W_]+/g, "-").replace(/^-+|-+$/g, "");
  return result;
};
