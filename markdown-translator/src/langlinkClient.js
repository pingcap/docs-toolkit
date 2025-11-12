const LANGLINK_HEADERS = {
  "Content-Type": "application/json",
  "x-langlink-access-key": process.env.LANGLINK_ACCESS_KEY,
  "x-langlink-access-secret": process.env.LANGLINK_ACCESS_SECRET,
  "x-langlink-user": process.env.LANGLINK_USER,
};

const OUTPUT_NODE_ID = "uXt40e3y1KhhHEKW-gmSN";
const RERUN_TIME = 3;
const RETRY_INTERVAL = 5000;
const RETRY_TIME = 60;

export const executeLangLinkTranslator = (appId, input, glossary) => {
  return new Promise((resolve, reject) => {
    const rerunLoop = async (rerunTime = 0) => {
      try {
        const result = await runLangLinkTranslator(appId, input, glossary);
        // # docs_translator is the content splitter in the langlink app's prompt
        resolve(result.replace("# docs_translator\n", ""));
      } catch {
        if (rerunTime < RERUN_TIME) {
          rerunLoop(++rerunTime);
        } else {
          reject(new Error(`Maximum rerun attempts reached: ${RERUN_TIME}.`));
        }
      }
    };
    rerunLoop();
  });
};

const runLangLinkTranslator = async (appId, input, glossary) => {
  const res = await fetch(
    `https://langlink.pingcap.net/langlink-api/applications/${appId}/async`,
    {
      method: "POST",
      body: JSON.stringify({
        input: { content: input, glossary: JSON.stringify(glossary) },
      }),
      headers: LANGLINK_HEADERS,
    }
  );
  const data = await res.json();
  const retryPromise = new Promise((resolve, reject) => {
    const getLangLinkResultLoop = async (retryTime = 0) => {
      const result = await getLangLinkResult(appId, data.id);
      if (!result.length) {
        if (retryTime < RETRY_TIME) {
          setTimeout(() => {
            getLangLinkResultLoop(++retryTime);
          }, RETRY_INTERVAL);
        } else {
          reject(new Error(`Maximum retry attempts reached: ${RETRY_TIME}.`));
        }
        return;
      }
      resolve(result.find((node) => node.block === OUTPUT_NODE_ID).output);
    };

    getLangLinkResultLoop();
  });

  return retryPromise;
};

const getLangLinkResult = async (appId, id) => {
  const res = await fetch(
    `https://langlink.pingcap.net/langlink-api/applications/${appId}/debug/${id}`,
    {
      method: "GET",
      headers: LANGLINK_HEADERS,
    }
  );
  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(JSON.stringify(data));
  }
  return data.debug;
};
