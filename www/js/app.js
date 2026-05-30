/**
 * 智能提词器 Pro — v2.5
 * 前置摄像头 · Capacitor 原生语音跟读 · 相机拍摄 · 文字浮镜
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
    scrollMode: 'auto',    // 'auto' | 'ai'
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
    // 语音识别跟读 (Capacitor 原生 SFSpeechRecognizer)
    recognition: null,           // Web Speech 实例
    _srPlugin: null,             // Capacitor 注册的 SpeechRecognition 插件引用
    recognitionType: null,       // 'capacitor' | 'webspeech' | null
    isRecognitionActive: false,
    lastRecognizedWords: '',
    recognitionRestartTimer: null,
    sensitivity: 7,              // 跟读灵敏度 1-10
    algoMode: 'fuzzy',           // 'fuzzy' | 'strict' | 'semantic'
    // 录制
    isRecording: false,
    recordingTimer: null,
    recordingStartTime: 0,
    recordingSeconds: 0,
  },

  /* ─── 初始化 ─── */
  init() {
    document.addEventListener('gesturestart', e => e.preventDefault());
    console.log('[提词器 v2.5] 前置镜头 · 原生语音跟读 · 相机拍摄 · 文字浮镜');
    // 预检测语音识别能力
    this._detectSpeechCapability();
  },

  /** 检测可用的语音识别引擎 */
  _detectSpeechCapability() {
    // 方式1: Capacitor 原生环境 — 延迟到实际使用时注册（等 bridge 就绪后 PluginHeaders 才可用）
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      this.state.recognitionType = 'capacitor';
      this.state._srPlugin = null; // 延迟注册
      console.log('[Speech] Capacitor 原生环境，插件将在 AI 模式启动时注册');
      return;
    }
    // 方式2: Web Speech API (浏览器/Safari 测试用)
    const WS = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (WS) {
      this.state.recognitionType = 'webspeech';
      console.log('[Speech] 检测到 Web Speech API (浏览器模式)');
      return;
    }
    this.state.recognitionType = null;
    console.warn('[Speech] 无可用语音识别引擎');
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
    // 兼容 'ai' 和 'voice' 两种传参
    const normalized = (mode === 'ai' || mode === 'voice') ? 'ai' : 'auto';
    this.state.scrollMode = normalized;
    document.getElementById('modeAuto').classList.toggle('active', normalized === 'auto');
    document.getElementById('modeAI').classList.toggle('active', normalized === 'ai');

    // 同步主页 AI 开关
    const aiToggle = document.getElementById('aiToggle');
    if (aiToggle) aiToggle.checked = (normalized === 'ai');
    const aiLabel = document.getElementById('aiLabel');
    if (aiLabel) aiLabel.textContent = normalized === 'ai' ? '已开启' : '已关闭';

    if (normalized === 'ai') {
      if (this.state.recognitionType === null) {
        // 还没检测过，重新检测
        this._detectSpeechCapability();
      }
      if (this.state.recognitionType) {
        this._startVoiceDetection();
      } else {
        alert('语音识别不可用\n\niOS WKWebView 不支持 Web Speech API。\n请确保已安装原生语音识别插件。');
        this.state.scrollMode = 'auto';
        document.getElementById('modeAuto').classList.add('active');
        document.getElementById('modeAI').classList.remove('active');
        if (aiToggle) aiToggle.checked = false;
        if (aiLabel) aiLabel.textContent = '不可用';
      }
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

  /* ═══════ 原生语音跟读 (Capacitor SFSpeechRecognizer + Web Speech 回退) ═══════ */
  async _startVoiceDetection() {
    this._stopVoiceDetection();

    if (this.state.recognitionType === 'capacitor') {
      await this._startCapacitorRecognition();
    } else if (this.state.recognitionType === 'webspeech') {
      this._startWebSpeechRecognition();
    } else {
      console.warn('[Speech] 无可用识别引擎');
    }
  },

  /** Capacitor 原生语音识别 (iOS SFSpeechRecognizer) */
  async _startCapacitorRecognition() {
    // 直接通过全局 Capacitor bridge 注册插件（此时 bridge 已就绪，PluginHeaders 可用）
    if (!this.state._srPlugin && window.Capacitor && window.Capacitor.registerPlugin) {
      try {
        this.state._srPlugin = window.Capacitor.registerPlugin('SpeechRecognition');
        console.log('[Speech] 插件已通过全局 Capacitor bridge 注册');
      } catch (e) {
        console.warn('[Speech] 插件注册失败:', e.message || e);
      }
    }

    const SR = this.state._srPlugin;
    if (!SR) {
      console.warn('[Speech] Capacitor 插件未就绪，请确认原生 SpeechRecognition 插件已安装');
      // 尝试用 Web Speech 回退
      this._startWebSpeechRecognition();
      return;
    }

    try {
      // 检查权限
      const permResult = await SR.requestPermission();
      if (!permResult.granted) {
        alert('需要语音识别权限才能使用 AI 跟读功能。\n请在系统设置中允许麦克风和语音识别。');
        return;
      }

      // 检查可用性
      const availResult = await SR.available();
      if (!availResult.available) {
        alert('此设备不支持语音识别。');
        return;
      }

      this.state.isRecognitionActive = true;
      console.log('[Speech] 原生识别引擎已启动');

      // 监听部分结果（实时）
      SR.addListener('partialResults', (data) => {
        if (!this.state.isRecognitionActive) return;
        if (!this.state.isRunning || this.state.isPaused) return;
        if (this.state.scrollMode !== 'ai') return;
        if (data.matches && data.matches.length > 0) {
          const transcript = data.matches[0];
          this.state.lastRecognizedWords = transcript;
          this._processRecognizedText(transcript);
        }
      });

      // 开始持续监听
      await SR.start({
        language: 'zh-CN',
        maxResults: 2,
        partialResults: true,
        popup: false,
      });

    } catch (e) {
      console.warn('[Speech] 原生识别启动失败:', e.message || e);
      // 尝试用 Web Speech 回退
      this._startWebSpeechRecognition();
    }
  },

  /** Web Speech API 回退 (浏览器/Safari 测试用) */
  _startWebSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Speech] 浏览器不支持语音识别');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'zh-CN';
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      if (!this.state.isRecognitionActive) return;
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (!transcript.trim()) return;
      this.state.lastRecognizedWords = transcript.trim();
      this._processRecognizedText(transcript.trim());
    };

    rec.onerror = (event) => {
      console.warn('[Speech] 识别错误:', event.error, event.message);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        this._scheduleWebSpeechRestart();
      }
    };

    rec.onend = () => {
      console.log('[Speech] Web Speech 会话结束');
      if (this.state.isRecognitionActive) {
        this._scheduleWebSpeechRestart();
      }
    };

    this.state.recognition = rec;
    this.state.lastRecognizedWords = '';

    try {
      rec.start();
      this.state.isRecognitionActive = true;
      console.log('[Speech] Web Speech 已启动');
    } catch (e) {
      console.warn('[Speech] Web Speech 启动失败:', e.message);
    }
  },

  _stopVoiceDetection() {
    this.state.isRecognitionActive = false;
    if (this.state.recognitionRestartTimer) {
      clearTimeout(this.state.recognitionRestartTimer);
      this.state.recognitionRestartTimer = null;
    }
    // 停止 Capacitor 原生识别
    const sr = this.state._srPlugin;
    if (sr) {
      try { sr.stop(); } catch (e) { /* 忽略 */ }
    }
    // 停止 Web Speech 实例
    if (this.state.recognition) {
      try { this.state.recognition.stop(); } catch (e) { /* 忽略 */ }
      this.state.recognition = null;
    }
    this.state.lastRecognizedWords = '';
  },

  /** Web Speech 自动重启 */
  _scheduleWebSpeechRestart() {
    if (!this.state.isRecognitionActive) return;
    if (this.state.recognitionRestartTimer) return;
    this.state.recognitionRestartTimer = setTimeout(() => {
      this.state.recognitionRestartTimer = null;
      if (!this.state.isRecognitionActive) return;
      const rec = this.state.recognition;
      if (rec) {
        try { rec.start(); console.log('[Speech] Web Speech 已重启'); }
        catch (e) { console.warn('[Speech] 重启失败:', e.message); }
      }
    }, 800);
  },

  /** 统一处理识别文本 */
  _processRecognizedText(transcript) {
    if (!this.state.isRunning || this.state.isPaused) return;
    if (this.state.scrollMode !== 'ai') return;
    if (!transcript || transcript.length < 2) return;

    const matchIdx = this._findBestMatch(transcript);
    if (matchIdx >= 0) {
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
      // 点击任意词可跳转
      span.addEventListener('click', () => this._onWordTap(i));
      content.appendChild(span);
      if (!/^[，。！？、；：""''（）【】]$/.test(word)) {
        content.appendChild(document.createTextNode(' '));
      }
    });
  },

  /** 点击词跳转 */
  _onWordTap(idx) {
    if (!this.state.isRunning) return;
    // 将该词之前的所有词标为已读
    for (let i = 0; i <= idx; i++) {
      const el = document.getElementById('w' + i);
      if (el) {
        if (i === idx) {
          el.className = 'word current';
          el.style.color = '#FFFFFF';
          el.style.background = 'rgba(255,69,58,0.7)';
        } else {
          el.className = 'word read';
          el.style.color = '';
          el.style.background = '';
        }
      }
    }
    // 后面的词恢复未读
    for (let i = idx + 1; i < this.state.words.length; i++) {
      const el = document.getElementById('w' + i);
      if (el) { el.className = 'word upcoming'; el.style.color = ''; el.style.background = ''; }
    }
    this.state.currentWordIndex = idx;
    // 滚动到视图
    const cur = document.getElementById('w' + idx);
    if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 显示提示
    this._showTapHint('已跳转到第 ' + (idx + 1) + ' 词');
  },

  _showTapHint(text) {
    let hint = document.getElementById('tap-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'tap-hint';
      document.getElementById('prompter-overlay').appendChild(hint);
    }
    hint.textContent = text;
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 1200);
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

    // 如果已选语音模式，启动语音识别
    if (this.state.scrollMode === 'ai') {
      this._startVoiceDetection();
    }
  },

  stopPrompter() {
    this.state.isRunning = false;
    document.getElementById('prompter-overlay').style.display = 'none';
    this._stopAutoScroll();
    this._stopVoiceDetection();
    this._stopRecording();
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
        if (this.state.scrollMode === 'ai') {
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

  toggleAI(checked) {
    if (checked) {
      this.setScrollMode('ai');
    } else {
      this.setScrollMode('auto');
    }
  },

  updateSensitivity(val) {
    this.state.sensitivity = parseInt(val);
    const d = document.getElementById('sensitivityVal');
    if (d) d.textContent = val;
    // 灵敏度影响匹配阈值：值越高阈值越低（越容易匹配）
  },

  setAlgoMode(mode, el) {
    this.state.algoMode = mode;
    document.querySelectorAll('#page-ai .card:nth-child(3) .speed-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  /* ═══════ 相机拍摄 & 录制 ═══════ */
  async capturePhoto() {
    // 切换录制模式（显示计时器）
    if (!this.state.isRecording) {
      this._startRecording();
    } else {
      this._stopRecording();
    }
  },

  _startRecording() {
    this.state.isRecording = true;
    this.state.recordingStartTime = Date.now();
    this.state.recordingSeconds = 0;

    // 显示计时器
    const timerEl = document.getElementById('recording-timer');
    if (timerEl) timerEl.style.display = 'flex';
    this._updateRecordingTimer();

    // 改变按钮样式为「录制中」
    const btn = document.querySelector('.bb-capture');
    if (btn) { btn.style.background = '#FF453A'; btn.style.color = 'white'; }

    console.log('[Camera] 录制开始');
  },

  _stopRecording() {
    this.state.isRecording = false;
    if (this.state.recordingTimer) {
      clearInterval(this.state.recordingTimer);
      this.state.recordingTimer = null;
    }

    // 隐藏计时器
    const timerEl = document.getElementById('recording-timer');
    if (timerEl) timerEl.style.display = 'none';

    // 恢复按钮样式
    const btn = document.querySelector('.bb-capture');
    if (btn) { btn.style.background = 'rgba(255,255,255,0.9)'; btn.style.color = '#000'; }

    // 拍摄一帧作为封面（canvas 截图）
    this._takeCanvasSnapshot();

    console.log('[Camera] 录制结束，时长:', this._formatTime(this.state.recordingSeconds));
  },

  _updateRecordingTimer() {
    if (this.state.recordingTimer) clearInterval(this.state.recordingTimer);
    this.state.recordingTimer = setInterval(() => {
      if (!this.state.isRecording) { clearInterval(this.state.recordingTimer); return; }
      const elapsed = Math.floor((Date.now() - this.state.recordingStartTime) / 1000);
      this.state.recordingSeconds = elapsed;
      const timeEl = document.getElementById('rec-time');
      if (timeEl) timeEl.textContent = this._formatTime(elapsed);
    }, 1000);
  },

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return m + ':' + s;
  },

  /** 从视频流截取一帧并保存到相册 (WKWebView 兼容) */
  _takeCanvasSnapshot() {
    const video = document.getElementById('cameraVideo');
    if (!video || video.readyState < 2) {
      console.warn('[Camera] 视频未就绪');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      // 镜像翻转（前置镜头通常需要）
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 闪屏效果
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999;opacity:0.6;pointer-events:none';
      document.body.appendChild(flash);
      requestAnimationFrame(() => { flash.style.transition = 'opacity 0.35s'; flash.style.opacity = '0'; });
      setTimeout(() => flash.remove(), 400);

      // 使用 navigator.share 保存图片（iOS 15+ WKWebView 兼容）
      // link.click() 在 WKWebView 中无法触发 data URL 下载
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.warn('[Camera] canvas.toBlob 失败');
          return;
        }
        const file = new File([blob], 'teleprompter-' + Date.now() + '.png', { type: 'image/png' });

        // 优先使用 Web Share API (触发 iOS 分享面板 → 保存图片)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
            console.log('[Camera] 截图已通过分享面板保存');
          } catch (e) {
            // 用户取消分享不算错误
            if (e.name !== 'AbortError') {
              console.warn('[Camera] 分享失败:', e.message || e);
            }
          }
        } else {
          // 回退：创建 Blob URL 下载（桌面浏览器测试用）
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'teleprompter-' + Date.now() + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          console.log('[Camera] 截图已通过下载链接保存');
        }
      }, 'image/png');

    } catch (e) {
      console.warn('[Camera] 截图失败:', e);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
