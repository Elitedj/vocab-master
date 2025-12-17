// 初始化右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-word",
    title: "将 '%s' 添加到生词本",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "add-word" && info.selectionText) {
    const word = info.selectionText.trim().toLowerCase();
    // 简单的英文校验
    if (/^[a-z]+(-[a-z]+)*$/i.test(word)) {
      await saveWord(word, tab.id);
    }
  }
});

async function saveWord(word, tabId) {
  const result = await chrome.storage.sync.get("vocab");
  const vocab = result.vocab || {};

  if (!vocab[word]) {
    // 1. 获取翻译和词性
    const { translation, pos } = await translateWord(word);
    
    vocab[word] = {
      translation,
      pos, // 新增：保存词性
      count: 0,
      addedAt: Date.now()
    };

    await chrome.storage.sync.set({ vocab });
    
    // UI 反馈
    chrome.action.setBadgeText({ text: "+1" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);

    // 2. 关键修改：发送 update 消息，而不是刷新页面
    // 同时也把新单词的数据发过去，避免 content.js 再次读取 storage
    chrome.tabs.sendMessage(tabId, { 
      action: "update_highlight", 
      newWord: word,
      data: vocab[word]
    });
  }
}

async function translateWord(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    
    // 提取翻译 (json[0][0][0])
    const translation = json?.[0]?.[0]?.[0] || "翻译异常";
    
    // 提取词性 (json[1] 通常包含词性列表)
    // 结构通常是: [ ["noun", [...]], ["verb", [...]] ]
    let pos = "";
    if (json[1] && json[1].length > 0) {
      // 取第一个词性，例如 "noun"
      pos = json[1][0][0]; 
    }

    return { translation, pos };
  } catch (e) {
    console.error(e);
    return { translation: "网络错误", pos: "" };
  }
}
