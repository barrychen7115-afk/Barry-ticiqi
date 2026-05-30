/**
 * 智能提词器 Pro — v2.2
 * 文字直接浮在镜头上 · 原生AI跟读 · 超清后置相机
 * Capacitor + esbuild · iPhone 13
 */

const App = {
  state: {
    // 样式
    fontSize: 28,
    fontColor: '#FFD60A',
    opacity: 90,
    lineHeight: 2.2,
    // 滚屏
    scrollMode: 'auto', // 'auto' | 'ai'
    speed: 1,
    isPaused: false,
    isRunning: false,
    textHidden: false,
    currentWordIndex: 0,
    words: [],
    scrollTimer: null,
    // 相机
    cameraStream: null,
    hasCamera: false,
    // AI跟读
    spokenBuffer: '',
    srReady: false,
  },

  /* ─── 初始化 ─── */
  init() {
    this._initSR();
    document.addEventListener('gesturestart', e => e.preventDefault());
    console.log('[提词器 v2.2] 竞品级体验 · 文字浮镜 · 原生AI跟读');
  },

  /* ═══════ 原生语音识别（通过 esbuild 打包的插件） ═══════ */
  async _initSR() {
    const SR = window._SpeechRecognition;
    if (!SR) {
      console.log('[提词器] 语音识别插件未加载');
      return;
    }
    try {
      const avail = await SR.available();
      if (avail.available) {
        this.state.srReady = true;
        console.log('[提词器] 原生 SFSpeechRecognizer 就绪');
      }
    } catch (e) {
      console.log('[提词器] 语音识别不可用:', e.message);
    }
  },

  async _startSR() {
    if (!this.state.srReady) return;
    try {
      const SR = window._SpeechRecognition;
      const perm = await SR.requestPermissions();
      if (!perm.speechRecognition || perm.speechRecognition !== 'granted') {
        console.warn('[提词器] 语音权限未授权');
        return;
      }
      // 监听部分识别结果
      SR.addListener('partialResults', (data) => {
        if (!this.state.isRunning || this.state.isPaused) return;
        if (this.state.scrollMode !== 'ai') return;
        if (data.matches && data.matches.length > 0) {
          this._onSRPartial(data.matches[0]);
        }
      });
      await SR.start({
        language: 'zh-CN',
        maxResults: 3,
        partialResults: true,
      });
      console.log('[提词器] 语音识别已启动');
    } catch (e) {
      console.warn('[提词器] 语音识别启动失败:', e.message);
    }
  },

  async _stopSR() {
    if (!this.state.srReady) return;
    try {
      await window._SpeechRecognition.stop();
    } catch (e) { /* ignore */ }
  },

  /** 部分识别 → 匹配台词位置 */
  _onSRPartial(spoken) {
    if (!spoken || typeof spoken !== 'string') return;

    // 累积 + 截断
    this.state.spokenBuffer = (this.state.spokenBuffer + spoken).slice(-300);

    // 拆成词
    const spokenWords = this.state.spokenBuffer.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
    if (spokenWords.length < 2) return;

    const script = this.state.words;
    const start = this.state.currentWordIndex;
    const lookAhead = Math.min(start + 40, script.length);

    let bestPos = -1, bestLen = 0;

    // 在当前位置往后搜最佳匹配
    for (let i = start; i < lookAhead; i++) {
      let matchLen = 0;
      for (let j = 0; j < spokenWords.length && (i + j) < script.length; j++) {
        if (script[i + j] === spokenWords[j]) { matchLen++; }
        else break;
      }
      if (matchLen > bestLen && matchLen >= 3) {
        bestLen = matchLen;
        bestPos = i;
      }
    }

    // 找到了超前匹配 → 快进
    if (bestPos > start + 1) {
      for (let k = start; k < bestPos; k++) {
        const el = document.getElementById('w' + k);
        if (el) { el.className = 'word read'; }
      }
      this.state.currentWordIndex = bestPos;
      this._highlightCurrent(false);
    }
  },

  /* ═══════ 页面导航 ═══════ */
  switchPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    const m = { home: 0, style: 1, ai: 2, about: 3 };
    const items = document.querySelectorAll('.nav-item');
    if (items[m[name]]) items[m[name]].classList.add('active');
  },

  /* ═══════ 设置 ═══════ */
  setSpeed(val, el) {
    this.state.speed = val;
    document.querySelectorAll('#page-home .speed-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  setColor(hex, el) {
    this.state.fontColor = hex;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    if (el) el.classList.add('active');
    const p = document.getElementById('fontPreview');
    if (p) { p.style.color = hex; p.style.textShadow = 'none'; }
    this._applyStyle();
  },

  updateFontSize(val) {
    this.state.fontSize = parseInt(val);
    const d = document.getElementById('fontSizeVal');
    if (d) d.textContent = val + 'px';
    const p = document.getElementById('fontPreview');
    if (p) p.style.fontSize = val + 'px';
    this._applyStyle();
  },

  updateOpacity(val) {
    this.state.opacity = parseInt(val);
    const v1 = document.getElementById('opacityVal');
    const v2 = document.getElementById('opacityVal2');
    if (v1) v1.textContent = val + '%';
    if (v2) v2.textContent = val + '%';
    const s = document.getElementById('overlayOpacity');
    if (s) s.value = val;
    this._applyStyle();
  },

  setBgStyle(style, el) {
    this.state.bgStyle = style;
    document.querySelectorAll('#page-style .card:nth-child(4) .speed-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyStyle();
  },

  setLineHeight(val, el) {
    this.state.lineHeight = val;
    document.querySelectorAll('#page-style .card:nth-child(5) .speed-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyStyle();
  },

  _applyStyle() {
    const content = document.getElementById('prompter-content');
    if (!content) return;
    content.style.color = this.state.fontColor;
    content.style.fontSize = this.state.fontSize + 'px';
    content.style.lineHeight = this.state.lineHeight;
    content.style.opacity = this.state.opacity / 100;
  },

  /* ═══════ 模式切换 ─══════ */
  setScrollMode(mode) {
    this.state.scrollMode = mode;
    document.getElementById('modeAuto').classList.toggle('active', mode === 'auto');
    document.getElementById('modeAI').classList.toggle('active', mode === 'ai');
    if (mode === 'ai' && this.state.isRunning) {
      this._startSR();
    } else if (mode === 'auto') {
      this._stopSR();
    }
  },

  toggleTextHide() {
    this.state.textHidden = !this.state.textHidden;
    const content = document.getElementById('prompter-content');
    if (content) content.classList.toggle('hidden-text', this.state.textHidden);
  },

  /* ═══════ 高清相机 ═══════ */
  async requestCamera() {
    const constraints = [
      { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false },
      { video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false },
    ];
    for (const c of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        this.state.cameraStream = stream;
        const video = document.getElementById('cameraVideo');
        if (video) { video.srcObject = stream; await video.play(); }
        this.state.hasCamera = true;
        return true;
      } catch (e) { continue; }
    }
    this.state.hasCamera = false;
    return false;
  },

  releaseCamera() {
    if (this.state.cameraStream) {
      this.state.cameraStream.getTracks().forEach(t => t.stop());
      this.state.cameraStream = null;
    }
    this.state.hasCamera = false;
  },

  /* ═══════ 解析台词 ═══════ */
  _parseWords(text) {
    return text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+|[^\s]/g) || [];
  },

  _renderContent() {
    const content = document.getElementById('prompter-content');
    content.innerHTML = '';
    this.state.words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'word upcoming';
      span.id = 'w' + i;
      span.textContent = word;
      content.appendChild(span);
      if (!/^[，。！？、；：""''（）【】]$/.test(word)) {
        content.appendChild(document.createTextNode(' '));
      }
    });
  },

  _highlightCurrent(smooth) {
    const idx = this.state.currentWordIndex;
    if (idx > 0) {
      const prev = document.getElementById('w' + (idx - 1));
      if (prev) { prev.className = 'word read'; }
    }
    const cur = document.getElementById('w' + idx);
    if (cur) {
      cur.className = 'word current';
      cur.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    }
  },

  /* ═══════ 开始提词 ═══════ */
  async startPrompter() {
    const text = document.getElementById('scriptInput').value.trim();
    if (!text) { alert('请先输入台词文本！'); return; }

    this.state.words = this._parseWords(text);
    this.state.currentWordIndex = 0;
    this.state.isPaused = false;
    this.state.isRunning = true;
    this.state.textHidden = false;
    this.state.spokenBuffer = '';

    const overlay = document.getElementById('prompter-overlay');
    overlay.style.display = 'block';

    this._renderContent();
    this._applyStyle();

    document.getElementById('pauseBtn').innerHTML = '&#x23F8;';
    document.getElementById('overlayOpacity').value = this.state.opacity;

    // 相机
    await this.requestCamera();

    // 自动滚屏（基础）
    this._startAutoScroll();

    // AI 模式
    if (this.state.scrollMode === 'ai') { this._startSR(); }
  },

  stopPrompter() {
    this.state.isRunning = false;
    document.getElementById('prompter-overlay').style.display = 'none';
    this._stopAutoScroll();
    this._stopSR();
    this.releaseCamera();
  },

  togglePause() {
    this.state.isPaused = !this.state.isPaused;
    document.getElementById('pauseBtn').innerHTML = this.state.isPaused ? '&#x25B6;' : '&#x23F8;';
  },

  /* ═══════ 自动滚屏 ═══════ */
  _startAutoScroll() {
    this._stopAutoScroll();
    const base = 500;
    const loop = () => {
      if (!this.state.isRunning) return;
      if (this.state.scrollMode === 'auto' && !this.state.isPaused) {
        this._advanceWord();
        this._highlightCurrent(true);
      }
      // AI模式下也低速滚动作为保底
      if (this.state.scrollMode === 'ai' && !this.state.isPaused) {
        // AI模式滚速极慢，让语音识别主导
        if (this.state.scrollTimer && this.state.scrollTimer % 3 === 0) {
          this._advanceWord();
          this._highlightCurrent(true);
        }
      }
      this.state.scrollTimer = setTimeout(loop, base / this.state.speed);
    };
    this.state.scrollTimer = setTimeout(loop, base / this.state.speed);
  },

  _stopAutoScroll() {
    if (this.state.scrollTimer) { clearTimeout(this.state.scrollTimer); this.state.scrollTimer = null; }
  },

  _advanceWord() {
    if (this.state.currentWordIndex >= this.state.words.length) {
      this.state.currentWordIndex = 0;
      this.state.words.forEach((_, i) => {
        const el = document.getElementById('w' + i);
        if (el) { el.className = 'word upcoming'; }
      });
    } else {
      this.state.currentWordIndex++;
    }
  },

  /* ═══════ 速度 ═══════ */
  fasterSpeed() { this.state.speed = Math.min(4, this.state.speed + 0.3); },
  slowerSpeed() { this.state.speed = Math.max(0.3, this.state.speed - 0.3); },

  /* ═══════ 透明度 ═══════ */
  updateOverlayOpacity(val) {
    this.state.opacity = parseInt(val);
    const v1 = document.getElementById('opacityVal');
    const v2 = document.getElementById('opacityVal2');
    if (v1) v1.textContent = val + '%';
    if (v2) v2.textContent = val + '%';
    const s1 = document.getElementById('opacitySlider');
    const s2 = document.getElementById('opacitySlider2');
    if (s1) s1.value = val;
    if (s2) s2.value = val;
    this._applyStyle();
  },

  /* ═══════ 位置重置 ═══════ */
  resetTextPosition() {
    const content = document.getElementById('prompter-content');
    if (content) content.scrollTop = 0;
  },

  /* ═══════ 工具 ═══════ */
  clearScript() { document.getElementById('scriptInput').value = ''; },
  loadSample() {
    document.getElementById('scriptInput').value = `大家好，我是今天的主播，欢迎收看本期节目。今天我们来聊一个大家都非常关心的话题——如何在忙碌的生活中保持身心健康。第一个建议是保证充足的睡眠，研究表明成年人每天需要7到8小时的高质量睡眠。第二个建议是坚持适量运动，每天只需要30分钟的有氧运动就能显著改善心肺功能。感谢大家的收看，记得点赞关注，我们下期再见！`;
  },

  /* ═══════ 演示 ═══════ */
  _demoTimer: null, _demoIdx: 0,
  runDemo() {
    if (this._demoTimer) { clearInterval(this._demoTimer); this._demoTimer = null; return; }
    this._demoIdx = 0;
    const words = document.querySelectorAll('#aiDemoText .word');
    words.forEach(w => w.className = 'word upcoming');
    this._demoTimer = setInterval(() => {
      if (this._demoIdx > 0) { words[this._demoIdx - 1].className = 'word read'; }
      if (this._demoIdx < words.length) {
        words[this._demoIdx].className = 'word current';
        this._demoIdx++;
      } else { clearInterval(this._demoTimer); this._demoTimer = null; }
    }, 600);
  },

  // 兼容
  toggleAI() {}, updateSensitivity() {}, setAlgoMode() {},
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
