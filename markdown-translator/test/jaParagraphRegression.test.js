import fs from "fs";
import path from "path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";

import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";

import { translatePhrasingChildren } from "../src/lib.js";
import {
  createComponentPlaceholderHtml,
  createLinkPlaceholderHtml,
} from "../src/placeholderUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "..", "docs-for-test", "en");

const parseMarkdown = (markdown) =>
  fromMarkdown(markdown, {
    extensions: [frontmatter(["yaml", "toml"]), gfm()],
    mdastExtensions: [
      frontmatterFromMarkdown(["yaml", "toml"]),
      gfmFromMarkdown(),
    ],
  });

const getParagraphFromFixture = (fixtureName, predicate) => {
  const markdown = fs.readFileSync(path.join(FIXTURE_DIR, fixtureName), "utf8");
  const ast = parseMarkdown(markdown);
  return ast.children.find(
    (node) => node.type === "paragraph" && (!predicate || predicate(node))
  );
};

const paragraphToMarkdown = (children) =>
  toMarkdown(
    {
      type: "paragraph",
      children,
    },
    {
      bullet: "-",
      extensions: [gfmToMarkdown()],
    }
  ).trimEnd();

test("translatePhrasingChildren preserves adjacent CustomContent groups in tidb-cloud-intro", async () => {
  const paragraph = getParagraphFromFixture(
    "tidb-cloud-intro.md",
    (node) =>
      node.children.some(
        (child) => child.type === "html" && child.value.includes("CustomContent")
      ) && node.children.some((child) => child.type === "link")
  );

  const enZhText =
    "You can create TiDB Cloud clusters to quickly build mission-critical applications on Amazon Web Services (AWS), Google Cloud, Microsoft Azure, and Alibaba Cloud.";
  const jaText =
    "You can create TiDB Cloud clusters to quickly build mission-critical applications on Amazon Web Services (AWS), Google Cloud, and Microsoft Azure.";
  const enZhTranslated =
    "TiDB Cloudクラスターを作成することで、Amazon Web Services（AWS）、Google Cloud、Microsoft Azure、およびAlibaba Cloud上にミッションクリティカルなアプリケーションを迅速に構築できます。";
  const jaTranslated =
    "TiDB Cloudクラスターを作成することで、Amazon Web Services（AWS）、Google Cloud、およびMicrosoft Azure上にミッションクリティカルなアプリケーションを迅速に構築できます。";

  const translateText = async (input) => {
    if (input === "TiDB Cloud") {
      return ["TiDB Cloud"];
    }
    if (input === "TiDB") {
      return ["TiDB"];
    }
    if (input === enZhText) {
      return [enZhTranslated];
    }
    if (input === jaText) {
      return [jaTranslated];
    }
    if (input.includes('data-docs-component-placeholder="2"')) {
      return [
        `${createLinkPlaceholderHtml(
          0,
          "https://www.pingcap.com/tidb-cloud/",
          "TiDB Cloud"
        )}は、オープンソースのハイブリッドトランザクションおよび分析処理（HTAP）データベースである${createLinkPlaceholderHtml(
          1,
          "https://docs.pingcap.com/tidb/stable/overview",
          "TiDB"
        )}をベースとした、フルマネージドのクラウドネイティブなデータベース・アズ・ア・サービス（DBaaS）です。TiDB Cloud は、データベースのデプロイと管理を容易にし、データベースの複雑さではなく、アプリケーションの開発に集中できるようにします。${createComponentPlaceholderHtml(
          2,
          enZhTranslated
        )}${createComponentPlaceholderHtml(3, jaTranslated)}`,
      ];
    }

    throw new Error(`Unexpected translation input: ${input}`);
  };

  const translatedChildren = await translatePhrasingChildren(
    structuredClone(paragraph.children),
    translateText
  );
  const restored = paragraphToMarkdown(translatedChildren);

  assert.equal(
    restored,
    '[TiDB Cloud](https://www.pingcap.com/tidb-cloud/)は、オープンソースのハイブリッドトランザクションおよび分析処理（HTAP）データベースである[TiDB](https://docs.pingcap.com/tidb/stable/overview)をベースとした、フルマネージドのクラウドネイティブなデータベース・アズ・ア・サービス（DBaaS）です。TiDB Cloud は、データベースのデプロイと管理を容易にし、データベースの複雑さではなく、アプリケーションの開発に集中できるようにします。<CustomContent language="en,zh">TiDB Cloudクラスターを作成することで、Amazon Web Services（AWS）、Google Cloud、Microsoft Azure、およびAlibaba Cloud上にミッションクリティカルなアプリケーションを迅速に構築できます。</CustomContent><CustomContent language="ja">TiDB Cloudクラスターを作成することで、Amazon Web Services（AWS）、Google Cloud、およびMicrosoft Azure上にミッションクリティカルなアプリケーションを迅速に構築できます。</CustomContent>'
  );
  assert.doesNotMatch(restored, /\b4\b|\b6\b/);
  assert.doesNotMatch(restored, /TiDB TiDB Cloud/);
});

test("translatePhrasingChildren keeps adjacent inline CustomContent variants separate", async () => {
  const paragraph = getParagraphFromFixture(
    "configure-external-storage-access.md",
    (node) =>
      node.children.some(
        (child) =>
          child.type === "html" &&
          child.value === '<CustomContent plan="starter,essential">'
      )
  );

  const translateText = async (input) => {
    if (input === "cluster") {
      return ["クラスター"];
    }
    if (input === "instance") {
      return ["インスタンス"];
    }
    if (input.includes('data-docs-component-placeholder="0"')) {
      return [
        `TiDB Cloud ${createComponentPlaceholderHtml(
          0,
          "クラスター"
        )}${createComponentPlaceholderHtml(
          1,
          "インスタンス"
        )} が Amazon S3 バケットにアクセスできるようにするには、${createComponentPlaceholderHtml(
          2,
          "クラスター"
        )}${createComponentPlaceholderHtml(
          3,
          "インスタンス"
        )} のバケットアクセスを次のいずれかの方法で設定します:`,
      ];
    }

    throw new Error(`Unexpected translation input: ${input}`);
  };

  const translatedChildren = await translatePhrasingChildren(
    structuredClone(paragraph.children),
    translateText
  );
  const restored = paragraphToMarkdown(translatedChildren);

  assert.equal(
    restored,
    'TiDB Cloud <CustomContent plan="starter,essential">クラスター</CustomContent><CustomContent plan="premium">インスタンス</CustomContent> が Amazon S3 バケットにアクセスできるようにするには、<CustomContent plan="starter,essential">クラスター</CustomContent><CustomContent plan="premium">インスタンス</CustomContent> のバケットアクセスを次のいずれかの方法で設定します:'
  );
});

test("translatePhrasingChildren preserves nested markdown children inside CustomContent groups", async () => {
  const ast = parseMarkdown(
    "Before <CustomContent plan=\"starter\">See [**Clusters**](https://tidbcloud.com/project/clusters) now.</CustomContent> after."
  );
  const paragraph = ast.children.find((node) => node.type === "paragraph");

  const translateText = async (input) => {
    if (input === "<strong>Clusters</strong>") {
      return ["<strong>Clusters</strong>"];
    }
    if (input.includes('data-docs-link-placeholder="0"')) {
      return [
        `参照 ${createLinkPlaceholderHtml(
          0,
          "https://tidbcloud.com/project/clusters",
          "**Clusters**"
        )}。`,
      ];
    }
    if (input.includes('data-docs-component-placeholder="0"')) {
      return [
        `前文 ${createComponentPlaceholderHtml(
          0,
          '参照 <a href="https://tidbcloud.com/project/clusters"><strong>Clusters</strong></a>。'
        )} 後文。`,
      ];
    }

    throw new Error(`Unexpected translation input: ${input}`);
  };

  const translatedChildren = await translatePhrasingChildren(
    structuredClone(paragraph.children),
    translateText
  );
  const restored = paragraphToMarkdown(translatedChildren);

  assert.equal(
    restored,
    '前文 <CustomContent plan="starter">参照 [**Clusters**](https://tidbcloud.com/project/clusters)。</CustomContent> 後文。'
  );
});

test("translatePhrasingChildren does not leak generic placeholder ids when the translator duplicates a placeholder", async () => {
  const ast = parseMarkdown(
    'If you have enabled AWS Key Management Service key (SSE-KMS) with customer-managed key encryption, make sure the following configuration is included in the policy. `"arn:aws:kms:ap-northeast-1:105880447796:key/c3046e91-fdfc-4f3a-acff-00597dd3801f"` is a sample KMS key of the bucket.'
  );
  const paragraph = ast.children.find((node) => node.type === "paragraph");

  const expected = paragraphToMarkdown(paragraph.children);

  const translateText = async (input) => {
    if (input.includes("{{B-PLACEHOLDER-0-PLACEHOLDER-E}}")) {
      return [
        input.replace(
          '<span translate="no">{{B-PLACEHOLDER-0-PLACEHOLDER-E}}</span>',
          '{{B-PLACEHOLDER-0-PLACEHOLDER-E}} <span translate="no">{{B-PLACEHOLDER-0-PLACEHOLDER-E}}</span>'
        ),
      ];
    }

    throw new Error(`Unexpected translation input: ${input}`);
  };

  const translatedChildren = await translatePhrasingChildren(
    structuredClone(paragraph.children),
    translateText
  );
  const restored = paragraphToMarkdown(translatedChildren);

  assert.equal(restored, expected);
  assert.doesNotMatch(restored, /\{\{B-PLACEHOLDER-\d+-PLACEHOLDER-E\}\}/);
  assert.doesNotMatch(restored, /<span\b[^>]*translate=["']no["'][^>]*>/i);
});

test("translatePhrasingChildren restores leading space before trailing GitHub issue links", async () => {
  const issueUrl = "https://github.com/pingcap/tiflow/issues/12277";
  const userUrl = "https://github.com/zurakutsia";
  const ast = parseMarkdown(
    `Fix the issue that changefeed tasks might get stuck when using Azure Blob Storage as the downstream [#12277](${issueUrl}) @[zurakutsia](${userUrl})`
  );
  const paragraph = ast.children.find((node) => node.type === "paragraph");

  const translateText = async (input) => {
    if (input === "#12277") {
      return ["#12277"];
    }
    if (input === "zurakutsia") {
      return ["zurakutsia"];
    }
    if (input.includes('data-docs-link-placeholder="0"')) {
      return [
        `Azure Blob Storage をダウンストリームとして使用している場合、changefeed タスクが停止する可能性がある問題を修正します${createLinkPlaceholderHtml(
          0,
          issueUrl,
          "#12277"
        )} @${createLinkPlaceholderHtml(1, userUrl, "zurakutsia")}`,
      ];
    }

    throw new Error(`Unexpected translation input: ${input}`);
  };

  const translatedChildren = await translatePhrasingChildren(
    structuredClone(paragraph.children),
    translateText
  );
  const restored = paragraphToMarkdown(translatedChildren);

  assert.equal(
    restored,
    `Azure Blob Storage をダウンストリームとして使用している場合、changefeed タスクが停止する可能性がある問題を修正します [#12277](${issueUrl}) @[zurakutsia](${userUrl})`
  );
});

test("translatePhrasingChildren does not add spaces before non-trailing GitHub issue links", async () => {
  const issueUrl = "https://github.com/pingcap/tiflow/issues/12277";
  const ast = parseMarkdown(`See [#12277](${issueUrl}) for details.`);
  const paragraph = ast.children.find((node) => node.type === "paragraph");

  const translateText = async (input) => {
    if (input === "#12277") {
      return ["#12277"];
    }
    if (input.includes('data-docs-link-placeholder="0"')) {
      return [
        `参照${createLinkPlaceholderHtml(0, issueUrl, "#12277")}詳細。`,
      ];
    }

    throw new Error(`Unexpected translation input: ${input}`);
  };

  const translatedChildren = await translatePhrasingChildren(
    structuredClone(paragraph.children),
    translateText
  );
  const restored = paragraphToMarkdown(translatedChildren);

  assert.equal(restored, `参照[#12277](${issueUrl})詳細。`);
});
