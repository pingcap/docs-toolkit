import AhoCorasick from "ahocorasick";

export const createGlossaryMatcher = async (githubUrl) => {
  const glossaryArray = githubUrl
    ? await downloadGithubGlossary(githubUrl)
    : [];

  // Convert array format to object format for AhoCorasick
  const glossary = glossaryArray.reduce((acc, item) => {
    if (item.en && item.zh) {
      acc[item.en] = item.zh;
    }
    return acc;
  }, {});

  // https://github.com/BrunoRB/ahocorasick
  const ac = new AhoCorasick(Object.keys(glossary).filter((t) => !!t));
  return (text) => {
    const results = ac
      .search(text)
      .map((matched) => matched[1])
      .flat();
    return results.reduce((prev, current) => {
      prev[current] = glossary[current];
      return prev;
    }, {});
  };
};

/**
 * 从GitHub下载词汇表文件
 * @param {string} githubUrl - GitHub raw文件URL
 * @returns {Promise<Array>} 词汇表数组
 */
export const downloadGithubGlossary = async (githubUrl) => {
  try {
    const response = await fetch(githubUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch glossary: ${response.statusText}`);
    }

    const content = await response.text();
    const lines = content.split("\n");

    // 跳过表头和分隔行
    const dataLines = lines
      .slice(2)
      .filter((line) => line.trim() && !line.startsWith("|:---"));

    const glossary = dataLines
      .map((line) => {
        const columns = line
          .split("|")
          .map((col) => col.trim())
          .filter((col) => col);
        if (columns.length >= 2) {
          return {
            en: columns[0],
            zh: columns[1],
            comments: columns[2] || "",
          };
        }
        return null;
      })
      .filter((item) => item !== null);

    console.log(
      `Downloaded glossary with ${glossary.length} terms from ${githubUrl}`
    );
    return glossary;
  } catch (error) {
    console.error("Error downloading glossary:", error);
    return [];
  }
};
