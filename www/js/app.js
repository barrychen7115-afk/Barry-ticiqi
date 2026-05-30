/**
 * 智能提词器 Pro — v2.4
 * 前置摄像头 · Web Speech 真·语音跟读 · 文字浮镜
 * Capacitor · iPhone 13
 */

const App = {
  state: {
    // 样式
    fontSize: 28,
    fontColor: '#FFD60A',
    opacity: 90,
    lineHeight: 2.2,
    // 滚屏
    scrollMode: 'auto',    // 'auto' | 'voice'
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
    // 语音识别跟读
    recognition: null,
    isRecognitionActive: false,
    lastRecognizedWords: '', // 上次识别到的文本，用于增量匹配
    recognitionRestartTimer: null,
    // 注意：NSSpeechRecognitionUsageDescription 已配置在 Info.plist
  },

  /* ─── 初始化 ─── */
  init() {
    document.addEventListener('gesturestart', e => e.preventDefault());
    console.log('[提词器 v2.4] 前置镜头 · Web Speech 真跟读 · 文字浮镜');
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
    this._applyStyle();
  },

  updateFontSize(val) {
    this.state.fontSize = parseInt(val);
    const d = document.getElementById('fontSizeVal');
    if (d) d.textContent = val + 'px';
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
    document.querySelectorAll('#page-style .card:nth-child(4) .speed-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
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

  /* ═══════ 模式切换 ═══════ */
  setScrollMode(mode) {
    this.state.scrollMode = mode;
    document.getElementById('modeAuto').classList.toggle('active', mode === 'auto');
    document.getElementById('modeAI').classList.toggle('active', mode === 'voice');
    if (mode === 'voice') {
      this._startVoiceDetection();
    } else {
      this._stopVoiceDetection();
    }
  },

  toggleTextHide() {
    this.state.textHidden = !this.state.textHidden;
    document.getElementById('prompter-content').classList.toggle('hidden-text', this.state.textHidden);
  },

  /* ═══════ 高清前置相机 ═══════ */
  async requestCamera() {
    // 优先前置镜头（自拍模式）
    const constraints = [
      { video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false },
      { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false },
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

  /* ═══════ Web Speech 真·语音跟读 ═══════ */
  async _startVoiceDetection() {
    this._stopVoiceDetection();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Speech] 浏览器不支持语音识别');
      // 回退：自动滚屏
      this.state.scrollMode = 'auto';
      document.getElementById('modeAuto').classList.add('active');
      document.getElementById('modeAI').classList.remove('active');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;       // 持续监听，不因停顿而结束
    rec.interimResults = true;   // 实时返回中间结果
    rec.lang = 'zh-CN';          // 中文普通话
    rec.maxAlternatives = 1;

    rec.onresult = (event) => this._onSpeechResult(event);
    rec.onerror = (event) => {
      console.warn('[Speech] 识别错误:', event.error, event.message);
      // 非致命错误（如 no-speech）自动重启
      if (event.error === 'no-speech' || event.error === 'aborted') {
        this._scheduleRecognitionRestart();
      }
    };
    rec.onend = () => {
      console.log('[Speech] 识别会话结束，自动重启');
      this._scheduleRecognitionRestart();
    };

    this.state.recognition = rec;
    this.state.lastRecognizedWords = '';

    try {
      rec.start();
      this.state.isRecognitionActive = true;
      console.log('[Speech] 语音识别已启动 (zh-CN)');
    } catch (e) {
      console.warn('[Speech] 启动失败:', e.message);
    }
  },

  _stopVoiceDetection() {
    this.state.isRecognitionActive = false;
    if (this.state.recognitionRestartTimer) {
      clearTimeout(this.state.recognitionRestartTimer);
      this.state.recognitionRestartTimer = null;
    }
    if (this.state.recognition) {
      try { this.state.recognition.stop(); } catch (e) {}
      this.state.recognition = null;
    }
    this.state.lastRecognizedWords = '';
  },

  /** 识别结束后延迟重启（处理短暂停顿） */
  _scheduleRecognitionRestart() {
    if (!this.state.isRecognitionActive) return;
    if (this.state.recognitionRestartTimer) return;
    this.state.recognitionRestartTimer = setTimeout(() => {
      this.state.recognitionRestartTimer = null;
      if (!this.state.isRecognitionActive) return;
      const rec = this.state.recognition;
      if (rec) {
        try { rec.start(); console.log('[Speech] 识别已重启'); }
        catch (e) { console.warn('[Speech] 重启失败:', e.message); }
      }
    }, 800);
  },

  /** 处理识别结果 — 核心匹配逻辑 */
  _onSpeechResult(event) {
    if (!this.state.isRunning || this.state.isPaused) return;
    if (this.state.scrollMode !== 'voice') return;

    // 收集所有识别到的文本（取最后一段连续结果）
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (!transcript.trim()) return;

    this.state.lastRecognizedWords = transcript.trim();
    // console.log('[Speech] 识别:', this.state.lastRecognizedWords);

    // 在脚本中找匹配位置
    const matchIdx = this._findBestMatch(this.state.lastRecognizedWords);
    if (matchIdx >= 0) {
      // 找到了！跳到匹配位置
      this._jumpToWord(matchIdx);
    }
  },

  /** 模糊匹配：用识别到的文本在脚本词数组中找最佳位置 */
  _findBestMatch(recognizedText) {
    const words = this.state.words;
    if (!words.length) return -1;

    // 取识别文本的最后 2~6 个汉字/词作为搜索模式
    const rClean = recognizedText.replace(/[，。！？、；：""''（）【】\s,.!?;:'"()]/g, '');
    if (rClean.length < 2) return -1;

    // 滑动窗口：在脚本词数组中找最佳匹配
    const searchLen = Math.min(rClean.length, 12);
    const pattern = rClean.slice(-searchLen); // 取尾部作为特征

    let bestIdx = -1;
    let bestScore = 0;

    // 沿脚本滑动窗口，每次移动一个词
    let scriptBuf = '';
    let bufStartIdx = 0;

    for (let i = 0; i < words.length; i++) {
      // 只取中文字符做匹配
      const clean = words[i].replace(/[，。！？、；：""''（）【】\s,.!?;:'"()]/g, '');
      scriptBuf += clean;

      // 保持窗口大小
      while (scriptBuf.length > searchLen + 20 && bufStartIdx < i) {
        const oldClean = words[bufStartIdx].replace(/[，。！？、；：""''（）【】\s,.!?;:'"()]/g, '');
        scriptBuf = scriptBuf.slice(oldClean.length);
        bufStartIdx++;
      }

      // 计算相似度（简单滑动匹配）
      const score = this._similarity(pattern, scriptBuf.slice(-Math.min(scriptBuf.length, searchLen * 2)));
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // 只有匹配度够高才更新位置（避免噪音误判）
    if (bestScore > 0.35 && bestIdx > this.state.currentWordIndex) {
      return bestIdx;
    }
    return -1;
  },

  /** 简单字符级相似度（基于最长公共子序列） */
  _similarity(a, b) {
    if (!a || !b) return 0;
    // 在 b 中滑动搜索 a
    let best = 0;
    for (let offset = 0; offset <= Math.max(0, b.length - Math.floor(a.length * 0.6)); offset++) {
      let matches = 0;
      for (let i = 0; i < a.length && (offset + i) < b.length; i++) {
        if (a[i] === b[offset + i]) matches++;
      }
      best = Math.max(best, matches / a.length);
    }
    return best;
  },

  /** 跳到指定词位置并高亮 */
  _jumpToWord(targetIdx) {
    // 如果目标已经在当前之后且差距不大（<3词），保持自然过渡
    const gap = targetIdx - this.state.currentWordIndex;
    if (gap <= 0) return;
    if (gap < 3) return; // 差距太小，避免频繁跳动

    // 批量更新：把 currentWordIndex 到 targetIdx-1 之间的词标为已读
    for (let i = this.state.currentWordIndex; i < targetIdx; i++) {
      const el = document.getElementById('w' + i);
      if (el) {
        el.className = 'word read';
        el.style.color = '';
        el.style.background = '';
      }
    }

    this.state.currentWordIndex = targetIdx;
    this._highlightCurrent(false); // 不用 smooth（跳转要快）
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
      if (prev) { prev.className = 'word read'; prev.style.color = ''; prev.style.background = ''; }
    }
    const cur = document.getElementById('w' + idx);
    if (cur) {
      cur.className = 'word current';
      cur.style.color = '#FFFFFF';
      cur.style.background = 'rgba(255,69,58,0.7)';
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
    this.state.lastRecognizedWords = '';

    const overlay = document.getElementById('prompter-overlay');
    overlay.style.display = 'block';

    this._renderContent();
    this._applyStyle();

    document.getElementById('pauseBtn').innerHTML = '&#x23F8;';
    document.getElementById('overlayOpacity').value = this.state.opacity;

    // 启动前置相机
    await this.requestCamera();

    // 自动滚屏
    this._startAutoScroll();

    // 如果已选语音模式，启动音量感应
    if (this.state.scrollMode === 'voice') {
      this._startVoiceDetection();
    }
  },

  stopPrompter() {
    this.state.isRunning = false;
    document.getElementById('prompter-overlay').style.display = 'none';
    this._stopAutoScroll();
    this._stopVoiceDetection();
    this.releaseCamera();
  },

  togglePause() {
    this.state.isPaused = !this.state.isPaused;
    document.getElementById('pauseBtn').innerHTML = this.state.isPaused ? '&#x25B6;' : '&#x23F8;';
  },

  /* ═══════ 自动滚屏 ═══════ */
  _startAutoScroll() {
    this._stopAutoScroll();
    const base = 480;
    const loop = () => {
      if (!this.state.isRunning) return;
      if (!this.state.isPaused && !this.state.textHidden) {
        if (this.state.scrollMode === 'voice') {
          // 语音模式：不自驱推进，仅刷新高亮
          this._highlightCurrent(true);
          this.state.scrollTimer = setTimeout(loop, 400);
          return;
        }
        // 匀速模式：按速度推进
        this._advanceWord();
        this._highlightCurrent(true);
        this.state.scrollTimer = setTimeout(loop, Math.max(80, base / this.state.speed));
        return;
      }
      this.state.scrollTimer = setTimeout(loop, 300);
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
        if (el) { el.className = 'word upcoming'; el.style.color = ''; el.style.background = ''; }
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

  resetTextPosition() {
    const ct = document.getElementById('prompter-content');
    if (ct) ct.scrollTop = 0;
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

  toggleAI() {}, updateSensitivity() {}, setAlgoMode() {},
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
