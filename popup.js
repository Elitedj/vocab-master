async function loadList() {
  const data = await chrome.storage.sync.get("vocab");
  const vocab = data.vocab || {};
  const container = document.getElementById("wordList");
  container.innerHTML = "";

  const sortedWords = Object.keys(vocab).sort((a,b) => vocab[b].count - vocab[a].count);

  sortedWords.forEach(word => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="word-info">
        <b>${word}</b> 
        <span style="color:#666; font-size:11px; font-style:italic; margin-right:5px;">${vocab[word].pos ? vocab[word].pos : ''}</span>
        <small>${vocab[word].translation}</small>
      </div>
      <span class="count-badge">${vocab[word].count}</span>
      <span class="del-btn" data-word="${word}">✕</span>
    `;
    container.appendChild(div);
  });

  document.querySelectorAll(".del-btn").forEach(btn => {
    btn.onclick = async (e) => {
      const w = e.target.dataset.word;
      delete vocab[w];
      await chrome.storage.sync.set({ vocab });
      loadList();
    };
  });
}

document.getElementById("clearBtn").onclick = async () => {
  if (confirm("确定清空吗？")) {
    await chrome.storage.sync.set({ vocab: {} });
    loadList();
  }
};

loadList();
