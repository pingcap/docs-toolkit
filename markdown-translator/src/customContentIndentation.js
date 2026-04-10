const CUSTOM_CONTENT_OPEN_RE = /^(\s*)<CustomContent\b[^>]*>\s*$/;
const CUSTOM_CONTENT_CLOSE_RE = /^(\s*)<\/CustomContent>\s*$/;
const CUSTOM_CONTENT_LINE_RE = /^(\s*)<\/?CustomContent\b[^>]*>\s*$/;
const FENCE_RE = /^(\s*)(`{3,}|~{3,})/;

const getLeadingSpaces = (line = "") => line.match(/^ */)?.[0].length ?? 0;

const isStandaloneCustomContentLine = (line = "") =>
  CUSTOM_CONTENT_LINE_RE.test(line);

const getFenceMask = (lines) => {
  const mask = Array(lines.length).fill(false);
  let activeFence = null;

  lines.forEach((line, index) => {
    const fenceMatch = line.match(FENCE_RE);
    if (!activeFence) {
      if (fenceMatch) {
        activeFence = {
          marker: fenceMatch[2][0],
          length: fenceMatch[2].length,
        };
        mask[index] = true;
      }
      return;
    }

    mask[index] = true;
    if (
      fenceMatch &&
      fenceMatch[2][0] === activeFence.marker &&
      fenceMatch[2].length >= activeFence.length
    ) {
      activeFence = null;
    }
  });

  return mask;
};

const findContextIndent = (lines, fenceMask, openIndex, currentIndent) => {
  for (let index = openIndex - 1; index >= 0; index--) {
    if (fenceMask[index]) {
      continue;
    }

    const line = lines[index];
    if (!line.trim() || isStandaloneCustomContentLine(line)) {
      continue;
    }

    if (getLeadingSpaces(line) > currentIndent) {
      continue;
    }

    return getLeadingSpaces(line);
  }

  return null;
};

const findInnerContentIndent = (lines, fenceMask, openIndex, closeIndex) => {
  for (let index = openIndex + 1; index < closeIndex; index++) {
    if (fenceMask[index]) {
      continue;
    }

    const line = lines[index];
    if (!line.trim() || isStandaloneCustomContentLine(line)) {
      continue;
    }

    return getLeadingSpaces(line);
  }

  return null;
};

const collectSourceStandaloneCustomContentIndents = (sourceMarkdown = "") => {
  const sourceLines = sourceMarkdown.split("\n");
  const sourceFenceMask = getFenceMask(sourceLines);

  return sourceLines.reduce((entries, line, index) => {
    if (sourceFenceMask[index] || !isStandaloneCustomContentLine(line)) {
      return entries;
    }

    entries.push({
      value: line.trim(),
      indent: getLeadingSpaces(line),
    });
    return entries;
  }, []);
};

const restoreSourceStandaloneCustomContentIndents = (
  lines,
  fenceMask,
  sourceMarkdown
) => {
  const sourceEntries =
    collectSourceStandaloneCustomContentIndents(sourceMarkdown);

  if (!sourceEntries.length) {
    return;
  }

  let sourceIndex = 0;
  lines.forEach((line, index) => {
    if (fenceMask[index] || !isStandaloneCustomContentLine(line)) {
      return;
    }

    const value = line.trim();
    while (
      sourceIndex < sourceEntries.length &&
      sourceEntries[sourceIndex].value !== value
    ) {
      sourceIndex++;
    }

    if (sourceIndex >= sourceEntries.length) {
      return;
    }

    lines[index] = `${" ".repeat(sourceEntries[sourceIndex].indent)}${value}`;
    sourceIndex++;
  });
};

export const normalizeStandaloneCustomContentIndentation = (
  markdown = "",
  sourceMarkdown = ""
) => {
  const lines = markdown.split("\n");
  const fenceMask = getFenceMask(lines);
  const stack = [];

  lines.forEach((line, index) => {
    if (fenceMask[index]) {
      return;
    }

    if (CUSTOM_CONTENT_OPEN_RE.test(line)) {
      stack.push({
        openIndex: index,
        targetIndent: findContextIndent(
          lines,
          fenceMask,
          index,
          getLeadingSpaces(line)
        ),
      });
      return;
    }

    if (!CUSTOM_CONTENT_CLOSE_RE.test(line) || !stack.length) {
      return;
    }

    const { openIndex, targetIndent } = stack.pop();
    const normalizedIndent =
      targetIndent ??
      findInnerContentIndent(lines, fenceMask, openIndex, index) ??
      getLeadingSpaces(lines[openIndex]);
    lines[openIndex] = `${" ".repeat(normalizedIndent)}${lines[
      openIndex
    ].trimStart()}`;
    lines[index] = `${" ".repeat(normalizedIndent)}${lines[index].trimStart()}`;
  });

  restoreSourceStandaloneCustomContentIndents(lines, fenceMask, sourceMarkdown);

  return lines.join("\n");
};
