// 示例配置文件：展示如何配置跳过文件功能
// 复制此文件为 config.js 并根据需要修改

// 需要跳过的具体文件列表（相对于 markdowns 目录的路径）
export const SKIP_FILES = [
  // 示例：跳过特定文件
  "getting-started/README.md",
  "tutorials/basic-example.md",
  "docs/api-reference.md",
  "changelog.md",
  "LICENSE.md",
];

// 是否启用精确文件路径跳过功能
export const ENABLE_SKIP_FILES = true;

// 跳过文件的匹配模式（支持通配符）
export const SKIP_PATTERNS = [
  // 示例：跳过所有 README.md 文件
  "**/README.md",

  // 示例：跳过所有 changelog 开头的文件
  "**/changelog*.md",

  // 示例：跳过所有 LICENSE 开头的文件
  "**/LICENSE*.md",

  // 示例：跳过特定目录下的所有文件
  "legacy/**/*.md",

  // 示例：跳过特定目录下的特定文件
  "docs/deprecated/*.md",
];

// 是否启用模式匹配跳过功能
export const ENABLE_SKIP_PATTERNS = true;

// 使用说明：
//
// 1. 精确文件路径匹配：
//    - 在 SKIP_FILES 数组中添加完整的相对路径
//    - 路径相对于 markdowns 目录
//    - 例如：["docs/api.md", "tutorials/example.md"]
//
// 2. 模式匹配：
//    - 支持 * 和 ** 通配符
//    - * 匹配单个目录或文件名
//    - ** 匹配任意深度的路径
//    - 例如：
//      - "**/README.md" 匹配所有 README.md 文件
//      - "docs/**/*.md" 匹配 docs 目录下所有 .md 文件
//      - "**/changelog*.md" 匹配所有 changelog 开头的文件
//
// 3. 启用/禁用功能：
//    - 设置 ENABLE_SKIP_FILES = false 禁用精确路径匹配
//    - 设置 ENABLE_SKIP_PATTERNS = false 禁用模式匹配
//    - 两个都设为 false 则完全禁用跳过功能
//
// 4. 日志输出：
//    - 程序会显示哪些文件被跳过以及跳过的原因
//    - 会显示总共找到多少文件，跳过了多少文件
