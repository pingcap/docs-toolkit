const GENERIC_PLACEHOLDER_MARKER_SPAN_REGEX =
  /<span\b[^>]*translate=["']no["'][^>]*>\s*\{\{B-PLACEHOLDER-(\d+)-PLACEHOLDER-E\}\}\s*<\/span>/gi;
const GENERIC_PLACEHOLDER_LEGACY_SPAN_REGEX =
  /<span\b[^>]*translate=["']no["'][^>]*>\s*([0-9]+)\s*<\/span>/gi;
const LINK_PLACEHOLDER_ATTR = "data-docs-link-placeholder";
const COMPONENT_PLACEHOLDER_ATTR = "data-docs-component-placeholder";
const LINK_PLACEHOLDER_REGEX = new RegExp(
  `<a\\b[^>]*${LINK_PLACEHOLDER_ATTR}=["'](\\d+)["'][^>]*>[\\s\\S]*?<\\/a>`,
  "gi"
);
const COMPONENT_PLACEHOLDER_REGEX = new RegExp(
  `<span\\b[^>]*${COMPONENT_PLACEHOLDER_ATTR}=["'](\\d+)["'][^>]*>[\\s\\S]*?<\\/span>`,
  "gi"
);

const escapeHtml = (text = "") =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const createLinkPlaceholderHtml = (index, href, text) => {
  const safeHref = escapeHtml(href);
  const safeText = escapeHtml(text);
  return `<a href="${safeHref}" translate="no" ${LINK_PLACEHOLDER_ATTR}="${index}">${safeText}</a>`;
};

export const createComponentPlaceholderHtml = (index, innerHtml = "") => {
  return `<span translate="no" ${COMPONENT_PLACEHOLDER_ATTR}="${index}">${innerHtml}</span>`;
};

export const restorePreservedPlaceholders = (html = "") => {
  const withLinkMarkers = html.replaceAll(LINK_PLACEHOLDER_REGEX, (_, index) => {
    return `{{B-PLACEHOLDER-${index}-PLACEHOLDER-E}}`;
  });
  const withComponentMarkers = withLinkMarkers.replaceAll(
    COMPONENT_PLACEHOLDER_REGEX,
    (_, index) => {
      return `{{B-PLACEHOLDER-${index}-PLACEHOLDER-E}}`;
    }
  );

  const withGenericMarkerSpans = withComponentMarkers.replaceAll(
    GENERIC_PLACEHOLDER_MARKER_SPAN_REGEX,
    (_, index) => {
      return `{{B-PLACEHOLDER-${index}-PLACEHOLDER-E}}`;
    }
  );
  const withGenericMarkers = withGenericMarkerSpans.replaceAll(
    GENERIC_PLACEHOLDER_LEGACY_SPAN_REGEX,
    (_, index) => {
      return `{{B-PLACEHOLDER-${index}-PLACEHOLDER-E}}`;
    }
  );

  // Some translation engines can duplicate the placeholder body while also keeping the
  // placeholder tag, which results in consecutive identical markers. Collapse those.
  return withGenericMarkers.replaceAll(
    /(\{\{B-PLACEHOLDER-(\d+)-PLACEHOLDER-E\}\})(?:\s*\1)+/g,
    "$1"
  );
};
