/**
 * 智能提词器 Pro — v2.3
 * 前置摄像头 · 音量感应跟读 · 文字浮镜
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
    // 音量感应
    audioCtx: null,
    analyser: null,
    voiceTimer: null,
    isSpeaking: false,
    silenceStart: 0,
    volumeHistory: [],
    noiseFloor: 30,        // 环境噪音基线（动态校准）
    lastSpeechTime: 0,     // 上次检测到说话的时间
  },

  /* ─── 初始化 ─── */
  init() {
    document.addEventListener('gesturestart', e => e.preventDefault());
    console.log('[提词器 v2.3] 前置镜头 · 音量感应跟读 · 文字浮镜');
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

  /* ═══════ 音量感应跟读 ═══════ */
  async _startVoiceDetection() {
    this._stopVoiceDetection();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const source = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      this.state.audioCtx = actx;
      this.state.analyser = analyser;
      this.state._audioStream = stream;
      this.state.noiseFloor = 30;
      this.state.volumeHistory = [];

      console.log('[VAD] 音量感应已启动');
      this._voiceLoop();
    } catch (e) {
      console.warn('[VAD] 麦克风不可用:', e.message);
    }
  },

  _stopVoiceDetection() {
    if (this.state.voiceTimer) { clearTimeout(this.state.voiceTimer); this.state.voiceTimer = null; }
    if (this.state.audioCtx) {
      this.state.audioCtx.close().catch(() => {});
      this.state.audioCtx = null;
      this.state.analyser = null;
    }
    if (this.state._audioStream) {
      this.state._audioStream.getTracks().forEach(t => t.stop());
      this.state._audioStream = null;
    }
  },

  _voiceLoop() {
    if (!this.state.isRunning && this.state.scrollMode !== 'voice') { this._stopVoiceDetection(); return; }
    if (!this.state.analyser || this.state.isPaused) {
      this.state.voiceTimer = setTimeout(() => this._voiceLoop(), 200);
      return;
    }

    // 读取音量
    const buf = new Uint8Array(this.state.analyser.frequencyBinCount);
    this.state.analyser.getByteFrequencyData(buf);
    let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i];
    const vol = sum / buf.length; // 0-255

    // 动态噪音校准（每 800ms 取最低音量）
    this.state.volumeHistory.push(vol);
    if (this.state.volumeHistory.length > 40) this.state.volumeHistory.shift();
    if (this.state.volumeHistory.length >= 20) {
      const sorted = [...this.state.volumeHistory].sort((a, b) => a - b);
      this.state.noiseFloor = sorted[Math.floor(sorted.length * 0.15)] * 1.4 + 5;
    }

    const threshold = Math.max(20, this.state.noiseFloor);

    if (vol > threshold) {
      this.state.isSpeaking = true;
      this.state.lastSpeechTime = performance.now();
      this.state.silenceStart = 0;
    } else {
      if (!this.state.silenceStart) this.state.silenceStart = performance.now();
      const silenceMs = performance.now() - this.state.silenceStart;
      if (silenceMs > 1200) {
        this.state.isSpeaking = false;
      }
    }

    // 根据说话状态控制滚屏
    if (this.state.scrollMode === 'voice' && !this.state.isPaused) {
      // 说话 → 正常滚；不说话 → 缓慢滚（不暂停，给用户追踪感）
      this.state._voiceScrollSpeed = this.state.isSpeaking ? 1.0 : 0.15;
    }

    this.state.voiceTimer = setTimeout(() => this._voiceLoop(), 150);
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
    this.state.isSpeaking = false;
    this.state.silenceStart = 0;

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
        const factor = this.state.scrollMode === 'voice' ? (this.state._voiceScrollSpeed || 1.0) : 1.0;
        this._advanceWord();
        this._highlightCurrent(true);
        this.state.scrollTimer = setTimeout(loop, Math.max(80, base / (this.state.speed * factor)));
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
