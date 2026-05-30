/**
 * 智能提词器 Pro — v2.0
 * 内置相机 + 悬浮窗 + 自动滚屏
 * Capacitor · iPhone 13
 */

const App = {
  state: {
    fontSize: 24,
    fontColor: '#FFFFFF',
    opacity: 85,
    bgStyle: 'blur',
    lineHeight: 1.9,
    speed: 1,              // 滚屏速度（基准间隔 ms / speed）
    sensitivity: 7,
    isPaused: false,
    isRunning: false,
    currentWordIndex: 0,
    words: [],
    scrollTimer: null,
    cameraStream: null,
    hasCamera: false,
  },

  /* ─── 初始化 ─── */
  init() {
    this._bindEvents();
    console.log('[提词器 v2.0] 初始化完成 · 自动滚屏模式');
  },

  _bindEvents() {
    document.addEventListener('gesturestart', e => e.preventDefault());
  },

  /* ═══════ 页面导航 ═══════ */
  switchPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    const navMap = { home: 0, style: 1, ai: 2, about: 3 };
    const items = document.querySelectorAll('.nav-item');
    if (items[navMap[name]]) items[navMap[name]].classList.add('active');
  },

  /* ═══════ 设置 ═══════ */
  setSpeed(val, el) {
    this.state.speed = val;
    const btns = document.querySelectorAll('#page-home .speed-btns .speed-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  setColor(hex, el) {
    this.state.fontColor = hex;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    if (el) el.classList.add('active');
    const preview = document.getElementById('fontPreview');
    if (preview) preview.style.color = hex;
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
    document.getElementById('overlayOpacity').value = val;
    this._applyStyle();
  },

  setBgStyle(style, el) {
    this.state.bgStyle = style;
    const btns = document.querySelectorAll('#page-style .card:nth-child(4) .speed-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyStyle();
  },

  setLineHeight(val, el) {
    this.state.lineHeight = val;
    const btns = document.querySelectorAll('#page-style .card:nth-child(5) .speed-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyStyle();
  },

  /* ═══════ 应用到悬浮窗 ═══════ */
  _applyStyle() {
    const content = document.getElementById('prompter-content');
    const floatEl = document.getElementById('prompter-float');
    if (!content || !floatEl) return;

    content.style.color = this.state.fontColor;
    content.style.fontSize = this.state.fontSize + 'px';
    content.style.lineHeight = this.state.lineHeight;

    const alpha = this.state.opacity / 100;
    const bgMap = {
      'blur':       `rgba(10,10,20,${alpha})`,
      'dark':       `rgba(0,0,0,${alpha})`,
      'dark-blue':  `rgba(5,15,35,${alpha})`,
      'gradient':   `rgba(10,10,20,${alpha})`,
      'none':       'transparent',
    };
    floatEl.style.background = bgMap[this.state.bgStyle] || bgMap['blur'];

    if (this.state.bgStyle === 'none') {
      floatEl.style.boxShadow = 'none';
      floatEl.style.backdropFilter = 'none';
      floatEl.style.webkitBackdropFilter = 'none';
    } else {
      floatEl.style.boxShadow = '0 8px 40px rgba(0,0,0,0.7)';
      floatEl.style.backdropFilter = 'blur(12px)';
      floatEl.style.webkitBackdropFilter = 'blur(12px)';
    }
  },

  /* ═══════ 镜头 ═══════ */
  async requestCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      this.state.cameraStream = stream;
      const video = document.getElementById('cameraVideo');
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      const tip = document.getElementById('cameraTip');
      if (tip) setTimeout(() => tip.classList.add('hidden'), 2000);
      this.state.hasCamera = true;
      return true;
    } catch (err) {
      console.warn('[提词器] 相机不可用：', err.message);
      this.state.hasCamera = false;
      return false;
    }
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

  /* ═══════ 开始提词 ═══════ */
  async startPrompter() {
    const text = document.getElementById('scriptInput').value.trim();
    if (!text) { alert('请先输入台词文本！'); return; }

    // 重置状态
    this.state.words = this._parseWords(text);
    this.state.currentWordIndex = 0;
    this.state.isPaused = false;
    this.state.isRunning = true;

    // 显示 overlay
    const overlay = document.getElementById('prompter-overlay');
    overlay.style.display = 'block';

    this._renderContent();
    this._applyStyle();
    this._setupDrag();

    document.getElementById('pauseBtn').innerHTML = '&#x23F8;';
    document.getElementById('floatTitle').textContent = '自动滚屏中';
    document.getElementById('overlayOpacity').value = this.state.opacity;

    // 启动相机
    await this.requestCamera();

    // 启动自动滚屏
    this._startAutoScroll();
  },

  /* 停止提词 */
  stopPrompter() {
    this.state.isRunning = false;
    document.getElementById('prompter-overlay').style.display = 'none';
    this._stopAutoScroll();
    this.releaseCamera();
  },

  /* 暂停/继续 */
  togglePause() {
    this.state.isPaused = !this.state.isPaused;
    document.getElementById('pauseBtn').innerHTML = this.state.isPaused ? '&#x25B6;' : '&#x23F8;';
    document.getElementById('floatTitle').textContent = this.state.isPaused ? '已暂停' : '自动滚屏中';
  },

  /* ═══════ 自动滚屏 ═══════ */
  _startAutoScroll() {
    this._stopAutoScroll();
    const baseInterval = 420; // 基准毫秒
    const loop = () => {
      if (!this.state.isRunning) return;
      if (!this.state.isPaused) this._advanceWord();
      this.state.scrollTimer = setTimeout(loop, baseInterval / this.state.speed);
    };
    this.state.scrollTimer = setTimeout(loop, baseInterval / this.state.speed);
  },

  _stopAutoScroll() {
    if (this.state.scrollTimer) {
      clearTimeout(this.state.scrollTimer);
      this.state.scrollTimer = null;
    }
  },

  _advanceWord() {
    const total = this.state.words.length;
    if (this.state.currentWordIndex >= total) {
      // 循环到开头
      this.state.currentWordIndex = 0;
      this.state.words.forEach((_, i) => {
        const el = document.getElementById('w' + i);
        if (el) { el.className = 'word upcoming'; el.style.color = ''; el.style.background = ''; }
      });
    }

    // 清除前一个高亮
    const prev = document.getElementById('w' + (this.state.currentWordIndex - 1));
    if (prev) { prev.className = 'word read'; prev.style.color = ''; prev.style.background = ''; }

    // 高亮当前词
    const cur = document.getElementById('w' + this.state.currentWordIndex);
    if (cur) {
      cur.className = 'word current';
      cur.style.color = '#FFD60A';
      cur.style.background = 'rgba(255,214,10,0.25)';
      cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    this.state.currentWordIndex++;
  },

  /* ═══════ 速度微调 ═══════ */
  fasterSpeed() {
    this.state.speed = Math.min(4, this.state.speed + 0.3);
    this._updateSpeedBadge();
  },

  slowerSpeed() {
    this.state.speed = Math.max(0.3, this.state.speed - 0.3);
    this._updateSpeedBadge();
  },

  _updateSpeedBadge() {
    const speeds = ['极慢', '慢', '适中', '快', '极快'];
    const idx = Math.round((this.state.speed - 0.3) / 0.925);
    const label = speeds[Math.min(4, Math.max(0, idx))] || '适中';
    document.getElementById('floatTitle').textContent = this.state.isPaused ? '已暂停' : '滚屏 · ' + label;
  },

  /* ═══════ overlay 透明度 ═══════ */
  updateOverlayOpacity(val) {
    this.state.opacity = parseInt(val);
    // 同步主页和样式页的滑块
    const v1 = document.getElementById('opacityVal');
    const v2 = document.getElementById('opacityVal2');
    if (v1) v1.textContent = val + '%';
    if (v2) v2.textContent = val + '%';
    // 同步滑块值
    const s1 = document.getElementById('opacitySlider');
    const s2 = document.getElementById('opacitySlider2');
    if (s1) s1.value = val;
    if (s2) s2.value = val;
    this._applyStyle();
  },

  /* ═══════ 拖动悬浮窗 ═══════ */
  _setupDrag() {
    const el = document.getElementById('prompter-float');
    const handle = document.getElementById('floatDragHandle');
    if (el._dragReady) return;
    el._dragReady = true;

    let sx, sy, sl, st, dragging = false;

    const onDown = (x, y) => {
      const r = el.getBoundingClientRect();
      sx = x; sy = y; sl = r.left; st = r.top;
      dragging = true;
      el.style.transition = 'none';
    };
    const onMove = (x, y) => {
      if (!dragging) return;
      const newLeft = Math.max(-60, Math.min(window.innerWidth - 60, sl + (x - sx)));
      const newTop = Math.max(30, Math.min(window.innerHeight - 120, st + (y - sy)));
      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
      el.style.right = 'auto';
    };
    const onUp = () => {
      dragging = false;
      el.style.transition = '';
    };

    handle.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0]; onDown(t.clientX, t.clientY);
    }, { passive: false });

    document.addEventListener('touchmove', e => {
      if (!dragging) return;
      const t = e.touches[0]; onMove(t.clientX, t.clientY);
    }, { passive: false });

    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);

    // PC 鼠标支持
    handle.addEventListener('mousedown', e => { onDown(e.clientX, e.clientY); });
    document.addEventListener('mousemove', e => { onMove(e.clientX, e.clientY); });
    document.addEventListener('mouseup', onUp);
  },

  /* ═══════ 工具 ═══════ */
  clearScript() { document.getElementById('scriptInput').value = ''; },

  loadSample() {
    document.getElementById('scriptInput').value = `大家好，我是今天的主播，欢迎收看本期节目。

今天我们来聊一个大家都非常关心的话题——如何在忙碌的生活中保持身心健康。

第一个建议是保证充足的睡眠。研究表明，成年人每天需要7到8小时的高质量睡眠。

第二个建议是坚持适量运动。每天只需要30分钟的有氧运动，就能显著改善我们的心肺功能。

感谢大家的收看，记得点赞关注，我们下期再见！`;
  },

  /* ═══════ 演示 ═══════ */
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

  // 旧 API 兼容
  toggleAI(enabled) {},
  updateSensitivity(val) {},
  setAlgoMode(mode, el) {},
  resetPosition() {
    const el = document.getElementById('prompter-float');
    el.style.left = '12px';
    el.style.right = '12px';
    el.style.top = '80px';
  },
};

/* 启动 */
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
