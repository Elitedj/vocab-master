// content.js
let vocabMap = {};
let tooltipEl = null;

// 初始化
async function init() {
  // 创建 Tooltip 容器 (解决遮挡问题的关键)
  createTooltipContainer();
  
  // 加载词库
  const data = await chrome.storage.sync.get("vocab");
  vocabMap = data.vocab || {};
  
  if (Object.keys(vocabMap).length > 0) {
    runHighlightProcess(true); // true 表示这是页面初次加载，需要更新计数
  }
}

// 监听后台消息
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "update_highlight") {
    vocabMap[msg.newWord] = msg.data;
    // 动态添加单词时，不强制全量更新计数，只高亮即可（或者你可以选择也更新）
    runHighlightProcess(false); 
  }
  if (msg.action === "refresh_highlight") {
     window.location.reload();
  }
});

// 主逻辑：扫描、高亮、统计
function runHighlightProcess(shouldUpdateCount) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      // 避免重复处理
      if (parent.classList.contains('vocab-highlight')) return NodeFilter.FILTER_REJECT;
      // 跳过脚本、样式等无关标签
      const tag = parent.tagName.toLowerCase();
      if (['script', 'style', 'textarea', 'input', 'noscript', 'select'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while(walker.nextNode()) nodes.push(walker.currentNode);

  // 用于统计本页面的词频
  const currentSessionCounts = {}; 

  nodes.forEach(node => {
    const text = node.nodeValue;
    if (!text.trim()) return;

    // 正则分割，保留分隔符以便重组
    const parts = text.split(/(\b[a-zA-Z]+\b)/g);
    
    let hasMatch = false;
    const fragment = document.createDocumentFragment();

    parts.forEach(part => {
      const lower = part.toLowerCase();
      const wordData = vocabMap[lower];

      if (wordData) {
        hasMatch = true;
        // 统计次数
        currentSessionCounts[lower] = (currentSessionCounts[lower] || 0) + 1;

        const span = document.createElement('span');
        span.className = 'vocab-highlight';
        span.textContent = part;
        
        // 将数据绑定在 DOM 属性上，供鼠标悬浮时读取
        span.dataset.trans = wordData.translation;
        span.dataset.pos = wordData.pos || "";
        span.dataset.count = wordData.count; // 注意：这是旧的总数，展示时我们通常展示 "历史总数"
        
        // 绑定事件：鼠标移入移出控制 Tooltip
        span.addEventListener('mouseenter', (e) => showTooltip(e, span));
        span.addEventListener('mouseleave', hideTooltip);
        
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    if (hasMatch) {
      node.parentNode.replaceChild(fragment, node);
    }
  });

  // 如果需要更新计数（页面初次加载时）且确实发现了单词
  if (shouldUpdateCount && Object.keys(currentSessionCounts).length > 0) {
    updateStorageCounts(currentSessionCounts);
  }
}

// 修复 Bug 1: 更新存储中的计数
async function updateStorageCounts(sessionCounts) {
  // 重新获取最新的 storage（防止覆盖）
  const data = await chrome.storage.sync.get("vocab");
  const currentVocab = data.vocab || {};
  let changed = false;

  for (const [word, count] of Object.entries(sessionCounts)) {
    if (currentVocab[word]) {
      currentVocab[word].count = (currentVocab[word].count || 0) + count;
      changed = true;
      
      // 同时更新内存中的 map，防止下次读取到旧数据
      if(vocabMap[word]) vocabMap[word].count = currentVocab[word].count;
    }
  }

  if (changed) {
    await chrome.storage.sync.set({ vocab: currentVocab });
    console.log("词频已同步更新:", sessionCounts);
  }
}

// 修复 Bug 2: 创建固定在 Body 的 Tooltip
function createTooltipContainer() {
  if (document.getElementById('vocab-tooltip-container')) return;
  
  tooltipEl = document.createElement('div');
  tooltipEl.id = 'vocab-tooltip-container';
  document.body.appendChild(tooltipEl);
}

function showTooltip(e, targetEl) {
  const trans = targetEl.dataset.trans;
  const count = targetEl.dataset.count;
  const pos = targetEl.dataset.pos;

  // 设置内容
  tooltipEl.innerHTML = `
    <div class="v-row"><span class="v-pos">${pos}</span> <span class="v-trans">${trans}</span></div>
    <div class="v-stat">累计遇见: ${count} 次</div>
  `;

  // 显示并计算位置
  tooltipEl.style.display = 'block';
  
  // 获取单词在视口中的位置
  const rect = targetEl.getBoundingClientRect();
  
  // 计算 Tooltip 位置：显示在单词上方 8px 处
  // 加上 window.scrollY 是为了转换成绝对坐标
  let top = rect.top + window.scrollY - tooltipEl.offsetHeight - 8;
  let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipEl.offsetWidth / 2);

  // 简单的边界检查（防止超出屏幕顶部）
  if (top < window.scrollY) {
    top = rect.bottom + window.scrollY + 8; // 改为显示在下方
  }

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}

function hideTooltip() {
  tooltipEl.style.display = 'none';
}

// 启动
init();
