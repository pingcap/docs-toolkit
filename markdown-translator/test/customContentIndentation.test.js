import test from "node:test";
import assert from "node:assert/strict";

import { normalizeStandaloneCustomContentIndentation } from "../src/customContentIndentation.js";

test("normalizes standalone CustomContent indentation in ordered-list export sections", () => {
  const input = [
    "    -   export intro",
    "",
    "        3.  before",
    "",
    "     <CustomContent plan=\"starter,essential\">",
    "",
    "    -   export bullet",
    "",
    "        1.  nested step",
    "",
    "     </CustomContent>",
    "",
    "     <CustomContent plan=\"premium\">",
    "",
    "    -   another export bullet",
    "",
    "     </CustomContent>",
  ].join("\n");

  const expected = [
    "    -   export intro",
    "",
    "        3.  before",
    "",
    "    <CustomContent plan=\"starter,essential\">",
    "",
    "    -   export bullet",
    "",
    "        1.  nested step",
    "",
    "    </CustomContent>",
    "",
    "    <CustomContent plan=\"premium\">",
    "",
    "    -   another export bullet",
    "",
    "    </CustomContent>",
  ].join("\n");

  assert.equal(normalizeStandaloneCustomContentIndentation(input), expected);
});

test("normalizes standalone CustomContent indentation in unordered-list descriptions", () => {
  const input = [
    "-   description",
    "",
    "    extra detail",
    "",
    "      <CustomContent platform=\"tidb\">",
    "",
    "    tidb-only note",
    "",
    "      </CustomContent>",
    "",
    "      <CustomContent platform=\"tidb-cloud\">",
    "",
    "    cloud-only note",
    "",
    "      </CustomContent>",
  ].join("\n");

  const expected = [
    "-   description",
    "",
    "    extra detail",
    "",
    "    <CustomContent platform=\"tidb\">",
    "",
    "    tidb-only note",
    "",
    "    </CustomContent>",
    "",
    "    <CustomContent platform=\"tidb-cloud\">",
    "",
    "    cloud-only note",
    "",
    "    </CustomContent>",
  ].join("\n");

  assert.equal(normalizeStandaloneCustomContentIndentation(input), expected);
});

test("does not rewrite inline CustomContent or fenced code examples", () => {
  const input = [
    "Inline <CustomContent plan=\"ja\">value</CustomContent> stays inline.",
    "",
    "```md",
    "      <CustomContent plan=\"starter,essential\">",
    "    literal example",
    "      </CustomContent>",
    "```",
  ].join("\n");

  assert.equal(normalizeStandaloneCustomContentIndentation(input), input);
});

test("keeps already-correct nested CustomContent indentation unchanged", () => {
  const input = [
    "    -   parent bullet",
    "",
    "        1.  nested step",
    "",
    "        <CustomContent plan=\"starter,essential\">",
    "",
    "        already aligned",
    "",
    "        </CustomContent>",
  ].join("\n");

  assert.equal(normalizeStandaloneCustomContentIndentation(input), input);
});

test("restores standalone CustomContent indentation from the source markdown", () => {
  const source = [
    "- **Multi-Cloud Support**",
    "",
    "    <CustomContent language=\"en,zh\">",
    "",
    "    Stay flexible.",
    "",
    "    </CustomContent>",
    "",
    "    <CustomContent language=\"ja\">",
    "",
    "    Stay flexible.",
    "",
    "    </CustomContent>",
  ].join("\n");
  const input = [
    "-   **Multi-Cloud Support**",
    "",
    "      <CustomContent language=\"en,zh\">",
    "",
    "    柔軟性を維持できます。",
    "",
    "      </CustomContent>",
    "",
    "      <CustomContent language=\"ja\">",
    "",
    "    柔軟性を維持できます。",
    "",
    "      </CustomContent>",
  ].join("\n");
  const expected = [
    "-   **Multi-Cloud Support**",
    "",
    "    <CustomContent language=\"en,zh\">",
    "",
    "    柔軟性を維持できます。",
    "",
    "    </CustomContent>",
    "",
    "    <CustomContent language=\"ja\">",
    "",
    "    柔軟性を維持できます。",
    "",
    "    </CustomContent>",
  ].join("\n");

  assert.equal(
    normalizeStandaloneCustomContentIndentation(input, source),
    expected
  );
});
