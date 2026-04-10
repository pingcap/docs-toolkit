import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  postProcessFileGithubMentions,
  fixMarkdownGithubMentions,
} from "../src/GithubMentions.js";

test("fixMarkdownGithubMentions: replaces github profile mention links", () => {
  const input = "Thanks @ [Aki](https://github.com/aki).\n";
  const expected = "Thanks @[aki](https://github.com/aki).\n";

  assert.equal(fixMarkdownGithubMentions(input), expected);
});

test("fixMarkdownGithubMentions: leaves non-github links unchanged", () => {
  const input = "Thanks @ [Aki](https://example.com/aki).\n";
  assert.equal(fixMarkdownGithubMentions(input), input);
});

test("fixMarkdownGithubMentions: handles multiple mentions in one line", () => {
  const input =
    "Reviewers: @ [Alpha](https://github.com/alpha), @ [Beta](https://github.com/beta/)\n";
  const expected =
    "Reviewers: @[alpha](https://github.com/alpha), @[beta](https://github.com/beta)\n";
  assert.equal(fixMarkdownGithubMentions(input), expected);
});

test("postProcessFileGithubMentions: updates file in-place", () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "github-mentions-postprocess-")
  );

  try {
    const filePath = path.join(tempDir, "doc.md");
    fs.writeFileSync(
      filePath,
      "Reviewers: @ [Alpha](https://github.com/alpha), @ [Beta](https://github.com/beta/)\n"
    );

    postProcessFileGithubMentions(filePath);

    const updated = fs.readFileSync(filePath, "utf8");
    assert.equal(
      updated,
      "Reviewers: @[alpha](https://github.com/alpha), @[beta](https://github.com/beta)\n"
    );

    assert.doesNotThrow(() =>
      postProcessFileGithubMentions(path.join(tempDir, "missing.md"))
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
