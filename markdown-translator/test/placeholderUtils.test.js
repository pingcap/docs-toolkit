import test from "node:test";
import assert from "node:assert/strict";

import {
  createComponentPlaceholderHtml,
  createLinkPlaceholderHtml,
  restorePreservedPlaceholders,
} from "../src/placeholderUtils.js";

test("createLinkPlaceholderHtml wraps translated link text in a restorable anchor", () => {
  assert.equal(
    createLinkPlaceholderHtml(3, "https://docs.pingcap.com/tidb/stable/overview", "TiDB"),
    '<a href="https://docs.pingcap.com/tidb/stable/overview" translate="no" data-docs-link-placeholder="3">TiDB</a>'
  );
});

test("restorePreservedPlaceholders restores link anchors back to placeholder markers", () => {
  const input =
    '<a href="https://www.pingcap.com/tidb-cloud/" translate="no" data-docs-link-placeholder="0">TiDB Cloud</a>は、<a data-docs-link-placeholder="1" translate="no" href="https://docs.pingcap.com/tidb/stable/overview">TiDB</a>をベースにしています。';

  assert.equal(
    restorePreservedPlaceholders(input),
    "{{B-PLACEHOLDER-0-PLACEHOLDER-E}}は、{{B-PLACEHOLDER-1-PLACEHOLDER-E}}をベースにしています。"
  );
});

test("restorePreservedPlaceholders keeps generic no-translate markers for non-link placeholders", () => {
  const input =
    '<span translate="no">2</span>body<span translate="no">3</span>';

  assert.equal(
    restorePreservedPlaceholders(input),
    "{{B-PLACEHOLDER-2-PLACEHOLDER-E}}body{{B-PLACEHOLDER-3-PLACEHOLDER-E}}"
  );
});

test("restorePreservedPlaceholders restores marker-bearing generic placeholders", () => {
  const input =
    '<span translate="no">{{B-PLACEHOLDER-2-PLACEHOLDER-E}}</span>body';

  assert.equal(
    restorePreservedPlaceholders(input),
    "{{B-PLACEHOLDER-2-PLACEHOLDER-E}}body"
  );
});

test("restorePreservedPlaceholders collapses consecutive duplicate placeholder markers", () => {
  const input =
    '{{B-PLACEHOLDER-2-PLACEHOLDER-E}} <span translate="no">{{B-PLACEHOLDER-2-PLACEHOLDER-E}}</span> body';

  assert.equal(
    restorePreservedPlaceholders(input),
    "{{B-PLACEHOLDER-2-PLACEHOLDER-E}} body"
  );
});

test("createComponentPlaceholderHtml wraps translated component content in a restorable span", () => {
  assert.equal(
    createComponentPlaceholderHtml(5, "translated body"),
    '<span translate="no" data-docs-component-placeholder="5">translated body</span>'
  );
});

test("restorePreservedPlaceholders restores component placeholders back to placeholder markers", () => {
  const input =
    '<span translate="no" data-docs-component-placeholder="5"><a href="https://docs.pingcap.com/tidb/stable/overview">TiDB</a></span>';

  assert.equal(
    restorePreservedPlaceholders(input),
    "{{B-PLACEHOLDER-5-PLACEHOLDER-E}}"
  );
});
