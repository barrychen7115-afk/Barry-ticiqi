/**
 * 智能提词器 Pro — 应用逻辑
 * Capacitor Edition · 适配 iOS WKWebView
 */

// ===== GLOBAL STATE =====
const App = {
  state: {
    fontSize: 24,
    fontColor: '#FFFFFF',
    opacity: 85,
    bgStyle: 'blur',
    lineHeight: 1.9,
    speed: 1,
    aiEnabled: true,
    sensitivity: 7,
    algoMode: 'fuzzy',
    isPaused: false,
    currentWordIndex: 0,
    words: [],
    scrollInterval: null,
    aiInterval: null,
    speechRecognition: null,
    isListening: false,
    cameraStream: null,
  },

  // ─── Lifecycle ───
  init() {
    this._bindEvents();
    this._initCapacitor();
    console.log('[提词器] 初始化完成');
  },

  _initCapacitor() {
    // Capacitor 就绪后更新安全区域
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener('backButton', () => {
        if (document.getElementById('prompter-overlay').style.display === 'block') {
          this.stopPrompter();
        }
      });
    }
    // Update safe-area on resize
    window.addEventListener('resize', () => {
      document.documentElement.style.setProperty(
        '--safe-top', 'env(safe-area-inset-top, 0px)'
      );
      document.documentElement.style.setProperty(
        '--safe-bottom', 'env(safe-area-inset-bottom, 0px)'
      );
    });
  },

  _bindEvents() {
    // Prevent iOS rubber-band effect in overlay
    document.addEventListener('gesturestart', e => e.preventDefault());
  },

  // ─── Camera ───
  async requestCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',         // 前置摄像头
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      this.state.cameraStream = stream;
      const video = document.getElementById('cameraVideo');
      if (video) {
        video.srcObject = stream;
        video.play();
      }
      return true;
    } catch (err) {
      console.warn('[提词器] 相机不可用，使用模拟背景', err);
      return false;
    }
  },

  releaseCamera() {
    if (this.state.cameraStream) {
      this.state.cameraStream.getTracks().forEach(t => t.stop());
      this.state.cameraStream = null;
    }
  },

  // ─── Page Navigation ───
  switchPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    const navMap = { home: 0, style: 1, ai: 2, about: 3 };
    const items = document.querySelectorAll('.nav-item');
    if (items[navMap[name]]) items[navMap[name]].classList.add('active');
  },

  // ─── Speed ───
  setSpeed(val, el) {
    this.state.speed = val;
    const btns = document.querySelectorAll('#page-home .speed-btns .speed-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  // ─── Color ───
  setColor(hex, el) {
    this.state.fontColor = hex;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    if (el) el.classList.add('active');
    const preview = document.getElementById('fontPreview');
    if (preview) preview.style.color = hex;
    this._applyStyle();
  },

  // ─── Font Size ───
  updateFontSize(val) {
    this.state.fontSize = parseInt(val);
    const display = document.getElementById('fontSizeVal');
    if (display) display.textContent = val + 'px';
    const preview = document.getElementById('fontPreview');
    if (preview) preview.style.fontSize = val + 'px';
    this._applyStyle();
  },

  // ─── Opacity ───
  updateOpacity(val) {
    this.state.opacity = parseInt(val);
    const v1 = document.getElementById('opacityVal');
    const v2 = document.getElementById('opacityVal2');
    if (v1) v1.textContent = val + '%';
    if (v2) v2.textContent = val + '%';
    this._applyStyle();
  },

  // ─── Background Style ───
  setBgStyle(style, el) {
    this.state.bgStyle = style;
    const btns = document.querySelectorAll('#page-style .card:nth-child(4) .speed-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyStyle();
  },

  // ─── Line Height ───
  setLineHeight(val, el) {
    this.state.lineHeight = val;
    const btns = document.querySelectorAll('#page-style .card:nth-child(5) .speed-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyStyle();
  },

  // ─── Sensitivity ───
  updateSensitivity(val) {
    this.state.sensitivity = parseInt(val);
    const d = document.getElementById('sensitivityVal');
    if (d) d.textContent = val;
  },

  // ─── Algo Mode ───
  setAlgoMode(mode, el) {
    this.state.algoMode = mode;
    const btns = document.querySelectorAll('#page-ai .speed-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  // ─── AI Toggle ───
  toggleAI(enabled) {
    this.state.aiEnabled = enabled;
    const label = document.getElementById('aiLabel');
    if (label) {
      label.textContent = enabled ? '已开启' : '已关闭';
      label.style.color = enabled ? 'var(--accent)' : 'var(--text-muted)';
    }
  },

  // ─── Apply Style (to floating window) ───
  _applyStyle() {
    const content = document.getElementById('prompter-content');
    const floatEl = document.getElementById('prompter-float');
    if (!content || !floatEl) return;

    content.style.color = this.state.fontColor;
    content.style.fontSize = this.state.fontSize + 'px';
    content.style.lineHeight = this.state.lineHeight;

    const alpha = this.state.opacity / 100;
    const bgMap = {
      'blur':       `rgba(10,10,15,${alpha})`,
      'dark':       `rgba(0,0,0,${alpha})`,
      'dark-blue':  `rgba(5,15,35,${alpha})`,
      'gradient':   `rgba(10,10,20,${alpha})`,
      'none':       'transparent',
    };
    floatEl.style.background = bgMap[this.state.bgStyle] || bgMap['blur'];

    if (this.state.bgStyle === 'blur' || this.state.bgStyle === 'dark-blue' || this.state.bgStyle === 'gradient') {
      floatEl.style.backdropFilter = 'blur(20px)';
      floatEl.style.webkitBackdropFilter = 'blur(20px)';
    } else {
      floatEl.style.backdropFilter = 'none';
      floatEl.style.webkitBackdropFilter = 'none';
    }
  },

  // ─── Parser ───
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

  // ─── Start Prompter ───
  async startPrompter() {
    const text = document.getElementById('scriptInput').value.trim();
    if (!text) { this._toast('请先输入台词文本！'); return; }

    this.state.words = this._parseWords(text);
    this.state.currentWordIndex = 0;
    this.state.isPaused = false;

    const overlay = document.getElementById('prompter-overlay');
    overlay.style.display = 'block';

    this._renderContent();
    this._applyStyle();
    this._setupDrag();

    document.getElementById('pauseBtn').textContent = '⏸';

    // Try to get camera
    await this.requestCamera();

    if (this.state.aiEnabled) {
      this._startAITracking();
    } else {
      this._startAutoScroll();
    }
  },

  stopPrompter() {
    document.getElementById('prompter-overlay').style.display = 'none';
    clearInterval(this.state.scrollInterval);
    this._stopAITracking();
    this.releaseCamera();
  },

  togglePause() {
    this.state.isPaused = !this.state.isPaused;
    document.getElementById('pauseBtn').textContent = this.state.isPaused ? '▶' : '⏸';
    if (this.state.isPaused) {
      clearInterval(this.state.scrollInterval);
      this._stopWaveform();
    } else {
      if (this.state.aiEnabled) this._startAITracking();
      else this._startAutoScroll();
    }
  },

  // ─── Auto Scroll (fallback) ───
  _startAutoScroll() {
    clearInterval(this.state.scrollInterval);
    this.state.scrollInterval = setInterval(() => {
      if (!this.state.isPaused) this._advanceWord();
    }, 400 / this.state.speed);
  },

  // ─── Word Advance ───
  _advanceWord() {
    const total = this.state.words.length;
    if (this.state.currentWordIndex >= total) return;

    const prev = document.getElementById('w' + (this.state.currentWordIndex - 1));
    if (prev) { prev.className = 'word read'; }

    const cur = document.getElementById('w' + this.state.currentWordIndex);
    if (cur) {
      cur.className = 'word current';
      cur.style.color = '#FFD60A';
      cur.style.background = 'rgba(255,214,10,0.2)';
      cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    this.state.currentWordIndex++;
  },

  _setWordIndex(idx) {
    this.state.words.forEach((_, i) => {
      const el = document.getElementById('w' + i);
      if (!el) return;
      if (i < idx) {
        el.className = 'word read'; el.style.color = ''; el.style.background = '';
      } else if (i === idx) {
        el.className = 'word current';
        el.style.color = '#FFD60A';
        el.style.background = 'rgba(255,214,10,0.2)';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.className = 'word upcoming'; el.style.color = ''; el.style.background = '';
      }
    });
    this.state.currentWordIndex = idx + 1;
  },

  // ─── AI Tracking ───
  _startAITracking() {
    this._startWaveform();
    document.getElementById('aiStatusText').textContent = '正在监听...';
    document.getElementById('statusText').textContent = 'AI 跟读中';

    // iOS WKWebView supports Web Speech API
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'zh-CN';

      rec.onresult = (ev) => {
        let t = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          t += ev.results[i][0].transcript;
        }
        if (t) {
          const conf = Math.round(ev.results[ev.results.length - 1][0].confidence * 100) || 85;
          document.getElementById('aiConfidence').textContent = conf + '%';
          document.getElementById('aiStatusText').textContent = t.slice(-12);
          this._matchAndAdvance(t);
        }
      };

      rec.onerror = (e) => {
        console.log('[提词器] 语音识别错误:', e.error);
        if (e.error === 'no-speech' || e.error === 'aborted') {
          // Normal, just restart after short delay
          setTimeout(() => {
            if (this.state.isListening) this._startAITracking();
          }, 600);
        }
      };

      rec.onend = () => {
        // Auto-restart (iOS Speech API has time limits)
        if (this.state.isListening && !this.state.isPaused) {
          setTimeout(() => this._startAITracking(), 300);
        }
      };

      try {
        rec.start();
        this.state.speechRecognition = rec;
        this.state.isListening = true;
      } catch (e) {
        console.warn('[提词器] 语音识别启动失败，使用模拟模式', e);
        this._simulateAI();
      }
    } else {
      // Fallback: simulate
      this._simulateAI();
    }
  },

  _stopAITracking() {
    this.state.isListening = false;
    if (this.state.speechRecognition) {
      try { this.state.speechRecognition.stop(); } catch(e) {}
      this.state.speechRecognition = null;
    }
    clearInterval(this.state.aiInterval);
    this._stopWaveform();
  },

  _simulateAI() {
    clearInterval(this.state.aiInterval);
    this.state.aiInterval = setInterval(() => {
      if (this.state.isPaused) return;
      const skip = Math.random() > 0.85 ? 2 : 1;
      for (let s = 0; s < skip; s++) this._advanceWord();
      const conf = 82 + Math.floor(Math.random() * 15);
      document.getElementById('aiConfidence').textContent = conf + '%';
    }, 500 / this.state.speed);
    this.state.isListening = true;
  },

  _matchAndAdvance(transcript) {
    const clean = transcript.replace(/\s+/g, '').replace(/[，。！？、；：]/g, '');
    const words = this.state.words;
    const start = Math.max(0, this.state.currentWordIndex - 2);
    const end = Math.min(words.length, this.state.currentWordIndex + 15);
    let bestIdx = -1, bestScore = 0;

    for (let i = start; i < end; i++) {
      const phrase = words.slice(i, Math.min(i + 5, words.length)).join('');
      const score = this._fuzzyScore(clean, phrase);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    const threshold = 0.8 - (this.state.sensitivity / 10) * 0.4;
    if (bestIdx >= 0 && bestScore > threshold) {
      this._setWordIndex(bestIdx);
    }
  },

  _fuzzyScore(a, b) {
    if (!a || !b) return 0;
    // Simple edit-distance-like matching
    let matches = 0, si = 0;
    for (let li = 0; li < a.length && si < b.length; li++) {
      if (a[li] === b[si]) { matches++; si++; }
    }
    return matches / Math.max(a.length, b.length, 1);
  },

  // ─── Waveform Animation ───
  _startWaveform() {
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.add('waving'));
  },
  _stopWaveform() {
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.remove('waving'));
  },

  // ─── Drag (Touch) ───
  _setupDrag() {
    const el = document.getElementById('prompter-float');
    const bar = el.querySelector('.prompter-titlebar');
    let sx, sy, sl, st;

    const onStart = (x, y) => {
      const r = el.getBoundingClientRect();
      sx = x; sy = y; sl = r.left; st = r.top;
    };
    const onMove = (x, y) => {
      el.style.left = Math.max(0, sl + (x - sx)) + 'px';
      el.style.top = Math.max(36, st + (y - sy)) + 'px';
      el.style.right = 'auto';
    };

    bar.addEventListener('touchstart', e => {
      const t = e.touches[0]; onStart(t.clientX, t.clientY);
      const mm = e2 => { const t2 = e2.touches[0]; onMove(t2.clientX, t2.clientY); };
      document.addEventListener('touchmove', mm, { passive: false });
      document.addEventListener('touchend', () => document.removeEventListener('touchmove', mm), { once: true });
    });

    // Also support mouse for desktop testing
    bar.addEventListener('mousedown', e => {
      onStart(e.clientX, e.clientY);
      const mm = e2 => onMove(e2.clientX, e2.clientY);
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', () => document.removeEventListener('mousemove', mm), { once: true });
    });
  },

  resetPosition() {
    const el = document.getElementById('prompter-float');
    el.style.left = '12px';
    el.style.right = '12px';
    el.style.top = '100px';
  },

  // ─── Utilities ───
  clearScript() {
    document.getElementById('scriptInput').value = '';
  },

  loadSample() {
    document.getElementById('scriptInput').value = `大家好，我是今天的主播，欢迎收看本期节目。

今天我们来聊一个大家都非常关心的话题——如何在忙碌的生活中保持身心健康。

第一个建议是保证充足的睡眠。研究表明，成年人每天需要7到8小时的高质量睡眠。

第二个建议是坚持适量运动。每天只需要30分钟的有氧运动，就能显著改善我们的心肺功能。

感谢大家的收看，记得点赞关注，我们下期再见！`;
  },

  _toast(msg) {
    // Simple toast for Capacitor environment
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Toast) {
      window.Capacitor.Plugins.Toast.show({ text: msg, duration: 'short' });
    } else {
      alert(msg);
    }
  },

  // ─── AI Demo ───
  _demoTimer: null,
  _demoIdx: 0,

  runDemo() {
    if (this._demoTimer) {
      clearInterval(this._demoTimer); this._demoTimer = null;
      return;
    }
    this._demoIdx = 0;
    const words = document.querySelectorAll('#aiDemoText .word');
    words.forEach(w => { w.className = 'word upcoming'; w.style.color = ''; w.style.background = ''; });
    this._demoTimer = setInterval(() => {
      if (this._demoIdx > 0) {
        const prev = words[this._demoIdx - 1];
        if (prev) { prev.className = 'word read'; prev.style.color = ''; prev.style.background = ''; }
      }
      if (this._demoIdx < words.length) {
        const cur = words[this._demoIdx];
        cur.className = 'word current';
        cur.style.color = '#FFD60A';
        cur.style.background = 'rgba(255,214,10,0.2)';
        this._demoIdx++;
      } else {
        clearInterval(this._demoTimer); this._demoTimer = null;
      }
    }, 600);
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Expose for onclick handlers
window.App = App;
