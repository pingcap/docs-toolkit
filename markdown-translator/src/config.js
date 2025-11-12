// 配置文件：定义需要跳过的文件列表
export const SKIP_FILES = [
  // 可以添加需要跳过的文件路径
  // 支持相对路径，相对于 markdowns 目录
  // 例如：
  // "getting-started/README.md",
  // "tutorials/basic-example.md",
  // "docs/api-reference.md"
  "TOC.md",
  "TOC-tidb-cloud.md",
];

// 是否启用跳过功能
export const ENABLE_SKIP_FILES = true;

// 跳过文件的匹配模式（支持通配符）
export const SKIP_PATTERNS = [
  // 可以添加文件模式，支持通配符
  // 例如：
  // "**/README.md",           // 跳过所有 README.md 文件
  // "**/changelog*.md",       // 跳过所有 changelog 开头的文件
  // "**/LICENSE*.md",         // 跳过所有 LICENSE 开头的文件
];

// 是否启用模式匹配跳过功能
export const ENABLE_SKIP_PATTERNS = true;
