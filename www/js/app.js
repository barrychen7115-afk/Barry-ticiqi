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
    // 语音识别跟随
    isRecognitionActive: false,
    _speechRec: null,             // SpeechRecognition 实例
    _volumeTimer: null,           // 音量检测降级用
    _audioCtx: null,
    _analyser: null,
    _volumePaused: false,
    // 录制
    isRecording: false,
    recordingTimer: null,
    recordingStartTime: 0,
    recordingSeconds: 0,
    mediaRecorder: null,         // MediaRecorder 实例
    recordedChunks: [],          // 录制的视频片段
  },

  /* ─── 初始化 ─── */
  init() {
    document.addEventListener('gesturestart', e => e.preventDefault());
    console.log('[逆象提词 v3.0] 语音跟随 · 前置镜头 · 视频录制');
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

  _setupPrompterScrollInteractions() {
    if (this._prompterScrollEventsAttached) return;
    const content = document.getElementById('prompter-content');
    if (!content) return;
    this._prompterScrollEventsAttached = true;

    const startScroll = () => {
      if (!this.state.isRunning) return;
      this.state.userScrollActive = true;
      this.state.isPaused = true;
      this._showTapHint('已启用手动滚动');
    };

    const stopScroll = () => {
      if (!this.state.userScrollActive) return;
      if (this._scrollStopTimer) clearTimeout(this._scrollStopTimer);
      this._scrollStopTimer = setTimeout(() => this._onScrollStopped(), 120);
    };

    const onScroll = () => {
      if (!this.state.userScrollActive) return;
      this.state.isPaused = true;
      if (this._scrollStopTimer) clearTimeout(this._scrollStopTimer);
      this._scrollStopTimer = setTimeout(() => this._onScrollStopped(), 180);
    };

    content.addEventListener('pointerdown', startScroll);
    content.addEventListener('touchstart', startScroll);
    content.addEventListener('mousedown', startScroll);
    content.addEventListener('pointerup', stopScroll);
    content.addEventListener('touchend', stopScroll);
    content.addEventListener('mouseup', stopScroll);
    content.addEventListener('scroll', onScroll);
  },

  _onScrollStopped() {
    this.state.userScrollActive = false;
    this._updateCurrentWordFromScroll();
  },

  _updateCurrentWordFromScroll() {
    const content = document.getElementById('prompter-content');
    if (!content || !this.state.words.length) return;

    const centerY = content.scrollTop + content.clientHeight / 2;
    let bestIdx = -1;
    let bestDelta = Infinity;

    this.state.words.forEach((_, i) => {
      const el = document.getElementById('w' + i);
      if (!el) return;
      const mid = el.offsetTop + el.offsetHeight / 2;
      const delta = Math.abs(mid - centerY);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    });

    if (bestIdx >= 0) {
      this.state.currentWordIndex = bestIdx;
      this._highlightCurrent(false);
    }
  },

  /* ═══════ 主页语音跟随开关 ═══════ */
  toggleAI(checked) {
    this.setScrollMode(checked ? 'voice' : 'auto');
  },

  /* ═══════ 模式切换 ═══════ */
  setScrollMode(mode) {
    // 兼容各种传参
    const normalized = (mode === 'ai' || mode === 'voice') ? 'voice' : 'auto';
    this.state.scrollMode = normalized;
    document.getElementById('modeAuto').classList.toggle('active', normalized === 'auto');
    document.getElementById('modeAI').classList.toggle('active', normalized === 'voice');

    // 同步主页语音跟随开关
    const aiToggle = document.getElementById('aiToggle');
    if (aiToggle) aiToggle.checked = (normalized === 'voice');
    const aiLabel = document.getElementById('aiLabel');
    if (aiLabel) aiLabel.textContent = normalized === 'voice' ? '已开启' : '已关闭';

    if (normalized === 'voice') {
      if (this.state.isRunning) {
        this._startVoiceDetection();
      }
    } else {
      this._stopVoiceDetection();
    }
  },

  toggleTextHide() {
    this.state.textHidden = !this.state.textHidden;
    document.getElementById('prompter-content').classList.toggle('hidden-text', this.state.textHidden);
  },

  /* ═════ 提词器主控 ═════ */
  async startPrompter() {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.currentWordIndex = 0;
    this.state._volumePaused = false;

    // 启动相机
    await this.requestCamera();

    // 渲染台词
    this._renderContent();

    // 显示提词 overlay
    document.getElementById('prompter-overlay').classList.add('active');

    // 启动滚动
    this._startAutoScroll();

    // 如果语音跟随模式，启动识别
    if (this.state.scrollMode === 'voice') {
      await this._startVoiceDetection();
    }

    console.log('[Prompter] 已启动，模式:', this.state.scrollMode);
  },

  stopPrompter() {
    this.state.isRunning = false;
    this.state.isPaused = false;
    this._stopAutoScroll();
    this._stopVoiceDetection();
    this.releaseCamera();
    document.getElementById('prompter-overlay').classList.remove('active');
    console.log('[Prompter] 已停止');
  },

  _startAutoScroll() {
    this._stopAutoScroll();
    const tick = () => {
      if (!this.state.isRunning || this.state.isPaused) return;
      if (this.state.scrollMode === 'voice' && this.state._volumePaused) {
        // 语音跟随模式 + 静音 → 极慢滚动
        this._scrollBy(0.15 * this.state.speed);
        this.state.scrollTimer = setTimeout(tick, 100);
        return;
      }
      const speed = this.state.scrollMode === 'voice' ? this.state.speed * 0.8 : this.state.speed;
      this._scrollBy(speed);
      this.state.scrollTimer = setTimeout(tick, 50);
    };
    tick();
  },

  _stopAutoScroll() {
    if (this.state.scrollTimer) {
      clearTimeout(this.state.scrollTimer);
      this.state.scrollTimer = null;
    }
  },

  _scrollBy(amount) {
    const content = document.getElementById('prompter-content');
    if (!content) return;
    content.scrollTop += amount;
    this._updateCurrentWord();
  },

  _updateCurrentWord() {
    const content = document.getElementById('prompter-content');
    if (!content || !this.state.words.length) return;
    const centerY = content.scrollTop + content.clientHeight / 2;
    let bestIdx = 0;
    let bestDelta = Infinity;
    this.state.words.forEach((_, i) => {
      const el = document.getElementById('w' + i);
      if (!el) return;
      const mid = el.offsetTop + el.offsetHeight / 2;
      const delta = Math.abs(mid - centerY);
      if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
    });
    if (bestIdx !== this.state.currentWordIndex) {
      this.state.currentWordIndex = bestIdx;
      this._highlightCurrent();
    }
  },

  _highlightCurrent() {
    const idx = this.state.currentWordIndex;
    this.state.words.forEach((_, i) => {
      const el = document.getElementById('w' + i);
      if (!el) return;
      el.classList.toggle('current-word', i === idx);
      el.classList.toggle('read-word', i < idx);
    });
  },

  _renderContent() {
    const content = document.getElementById('prompter-content');
    if (!content) return;
    const text = document.getElementById('scriptInput').value.trim();
    if (!text) return;
    const words = text.split(/(\s+|[，。！？、；：""''（）【】]+)/).filter(Boolean);
    this.state.words = words;
    content.innerHTML = words.map((w, i) => '<span id="w' + i + '" class="word">' + w + '</span>').join('');
    this.state.currentWordIndex = 0;
  },

  slowerSpeed() {
    this.state.speed = Math.max(0.2, this.state.speed - 0.3);
    console.log('[Prompter] 减速至:', this.state.speed);
  },

  fasterSpeed() {
    this.state.speed = Math.min(5, this.state.speed + 0.3);
    console.log('[Prompter] 加速至:', this.state.speed);
  },

  togglePause() {
    this.state.isPaused = !this.state.isPaused;
    const btn = document.getElementById('pauseBtn');
    if (btn) btn.textContent = this.state.isPaused ? '▶' : '⏸';
    console.log('[Prompter]', this.state.isPaused ? '暂停' : '继续');
  },

  updateOverlayOpacity(val) {
    const content = document.getElementById('prompter-content');
    if (content) content.style.opacity = parseInt(val) / 100;
  },

  resetTextPosition() {
    const content = document.getElementById('prompter-content');
    if (content) content.scrollTop = 0;
    this.state.currentWordIndex = 0;
    this._highlightCurrent();
  },

  /* ═══════ 高清前置相机 ═══════ */
  async requestCamera() {
    // 优先前置镜头（自拍模式）
    const constraints = [
      { video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: true },
      { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: true },
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

  /* ═════ 语音跟随引擎（Web Speech API + 模糊匹配定位） ═════ */

  /**
   * 启动语音跟随：优先使用 Web Speech API 识别说话内容，
   * 通过模糊匹配在台词中定位当前位置，即使漏读几个字也能跟随。
   * 降级方案：若不支持语音识别，则回退到音量感应模式。
   */
  async _startVoiceDetection() {
    this._stopVoiceDetection();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      this._startSpeechTracking(SR);
    } else {
      console.warn('[Voice] 不支持 SpeechRecognition，回退到音量感应模式');
      this._startVolumeDetection();
    }
  },

  /** 语音识别跟随核心 */
  _startSpeechTracking(SR) {
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.state._speechRec = rec;
    this.state.isRecognitionActive = true;

    // 提取纯文字（去标点空格）用于匹配
    const plainWords = this.state.words.map(w => w.replace(/[\s，。！？、；：""''（）【】\n]/g, ''));
    // 拼接成连续字符串便于滑窗搜索
    const fullText = plainWords.join('');
    // 每个字对应原始 words 的索引
    const charToWordIdx = [];
    plainWords.forEach((w, wi) => { for (let c = 0; c < w.length; c++) charToWordIdx.push(wi); });

    // 上次确认的字符位置（防止往回跳）
    let confirmedCharPos = 0;

    /**
     * 模糊匹配：在 fullText 中从 startPos 开始向后，
     * 找到与 spoken（刚识别的字符串）相似度最高的位置
     * 返回匹配到的 charIdx（fullText 中的起始索引）
     */
    const fuzzyFind = (spoken, startPos) => {
      if (!spoken || !fullText) return -1;
      // 去标点、空格，只保留汉字/字母数字
      const query = spoken.replace(/[\s，。！？、；：""''（）【】\n]/g, '').slice(-12); // 取最后12字做锚点
      if (!query) return -1;
      const queryLen = query.length;
      // 搜索范围：从已确认位置开始，向后最多扫 200 字
      const searchEnd = Math.min(fullText.length - queryLen, startPos + 200);
      let bestScore = 0;
      let bestPos = -1;
      for (let i = startPos; i <= searchEnd; i++) {
        const segment = fullText.slice(i, i + queryLen);
        const score = this._strSimilarity(query, segment);
        if (score > bestScore) { bestScore = score; bestPos = i; }
      }
      // 相似度超过 0.45 才认为匹配（容错漏字）
      return bestScore >= 0.45 ? bestPos : -1;
    };

    rec.onresult = (event) => {
      if (!this.state.isRunning || this.state.scrollMode !== 'voice') return;
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (!transcript.trim()) return;
      const charPos = fuzzyFind(transcript, confirmedCharPos);
      if (charPos < 0) return;

      // 只有 final result 才确认更新位置（interim 仅供调试）
      const isFinal = event.results[event.results.length - 1].isFinal;
      if (isFinal) confirmedCharPos = charPos;

      const wordIdx = charToWordIdx[charPos] ?? charToWordIdx[charPos + 1];
      if (wordIdx != null && wordIdx > this.state.currentWordIndex - 3) {
        this._jumpToWord(wordIdx);
        console.log('[Voice] 识别到:', transcript.slice(-8), '-> 定位到第', wordIdx, '词');
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') {
        // 无声音，不算错误，继续
        return;
      }
      console.warn('[Voice] 识别错误:', e.error);
      // 权限被拒或不支持时，回退到音量感应
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this._startVolumeDetection();
      }
    };

    rec.onend = () => {
      // 如果提词器仍在运行且在语音模式，自动重启识别
      if (this.state.isRunning && this.state.scrollMode === 'voice' && this.state.isRecognitionActive) {
        try { rec.start(); } catch(e) {}
      }
    };

    try {
      rec.start();
      console.log('[Voice] 语音跟随已启动');
    } catch(e) {
      console.warn('[Voice] 启动失败:', e.message);
      this._startVolumeDetection();
    }
  },

  /**
   * 计算两个字符串的相似度（0~1）
   * 基于公共字符比例，适合中文容错匹配
   */
  _strSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const len = Math.max(a.length, b.length);
    let matches = 0;
    const used = new Array(b.length).fill(false);
    for (let i = 0; i < a.length; i++) {
      for (let j = Math.max(0, i - 3); j < Math.min(b.length, i + 4); j++) {
        if (!used[j] && a[i] === b[j]) { matches++; used[j] = true; break; }
      }
    }
    return matches / len;
  },

  /** 将提词器滚动到指定词（平滑动画） */
  _jumpToWord(wordIdx) {
    const content = document.getElementById('prompter-content');
    if (!content) return;
    const el = document.getElementById('w' + wordIdx);
    if (!el) return;
    // 目标：让该词出现在屏幕中间
    const targetScrollTop = el.offsetTop - content.clientHeight / 2 + el.offsetHeight / 2;
    // 平滑滚动（分多步完成，避免画面跳跃）
    const current = content.scrollTop;
    const diff = targetScrollTop - current;
    if (Math.abs(diff) < 5) return;
    // 只向前跳，不往后退（防止识别错误导致跳回）
    if (targetScrollTop < current - 60) return;
    const steps = 8;
    let step = 0;
    const animate = () => {
      if (step >= steps) return;
      step++;
      content.scrollTop += diff / steps;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    // 更新高亮
    this.state.currentWordIndex = wordIdx;
    this._highlightCurrent();
  },

  /** 降级：音量感应（仅控制滚动速度，无文字定位） */
  _startVolumeDetection() {
    const stream = this.state.cameraStream;
    if (!stream) { console.warn('[Volume] 无媒体流'); return; }
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let isSpeaking = false;
      let silenceStart = null;
      this.state._audioCtx = audioCtx;
      this.state._analyser = analyser;
      this.state.isRecognitionActive = true;
      this.state._volumeTimer = setInterval(() => {
        if (!this.state.isRunning || this.state.scrollMode !== 'voice') return;
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const volume = sum / buffer.length;
        const now = Date.now();
        if (volume > 40) {
          if (!isSpeaking) { isSpeaking = true; }
          silenceStart = null;
          this.state._volumePaused = false;
        } else {
          if (isSpeaking) { isSpeaking = false; silenceStart = now; }
          if (silenceStart && (now - silenceStart) > 1500) { this.state._volumePaused = true; }
        }
      }, 150);
      console.log('[Volume] 音量感应降级模式已启动');
    } catch (e) { console.warn('[Volume] 启动失败:', e.message || e); }
  },

  _stopVoiceDetection() {
    this.state.isRecognitionActive = false;
    // 停止语音识别
    if (this.state._speechRec) {
      try { this.state._speechRec.stop(); } catch(e) {}
      this.state._speechRec = null;
    }
    // 停止音量检测
    if (this.state._volumeTimer) { clearInterval(this.state._volumeTimer); this.state._volumeTimer = null; }
    if (this.state._audioCtx) { try { this.state._audioCtx.close(); } catch(e){} this.state._audioCtx = null; }
    this.state._analyser = null;
    this.state._volumePaused = false;
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
    this.state.recordedChunks = [];

    // 显示计时器
    const timerEl = document.getElementById('recording-timer');
    if (timerEl) timerEl.style.display = 'flex';
    this._updateRecordingTimer();

    // 改变按钮样式为「录制中」
    const btn = document.querySelector('.bb-capture');
    if (btn) { btn.style.background = '#FF453A'; btn.style.color = 'white'; }

    // 启动 MediaRecorder 录制视频流
    this._startMediaRecorder();

    console.log('[Camera] 录制开始');
  },

  _startMediaRecorder() {
    const stream = this.state.cameraStream;
    if (!stream) {
      console.warn('[Camera] 无视频流，无法录制');
      return;
    }

    try {
      // 优先使用 mp4 格式（iOS 原生支持）
      const mimeTypes = [
        'video/mp4',
        'video/mp4;codecs=avc1',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      let mimeType = '';
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          mimeType = mt;
          break;
        }
      }

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      this.state.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.state.recordedChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        this._saveRecordedVideo();
      };

      recorder.onerror = (e) => {
        console.warn('[Camera] MediaRecorder 错误:', e.message || e);
      };

      // 每 1 秒收集一次数据（确保有数据）
      recorder.start(1000);
      console.log('[Camera] MediaRecorder 已启动，格式:', mimeType || '默认');

    } catch (e) {
      console.warn('[Camera] MediaRecorder 启动失败:', e.message || e);
    }
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

    // 停止 MediaRecorder
    const recorder = this.state.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
        console.log('[Camera] MediaRecorder 已停止');
      } catch (e) {
        console.warn('[Camera] 停止 MediaRecorder 失败:', e.message || e);
      }
    } else {
      // 如果没有 MediaRecorder，回退到截图
      this._takeCanvasSnapshot();
    }

    console.log('[Camera] 录制结束，时长:', this._formatTime(this.state.recordingSeconds));
  },

  /** 将录制的视频保存到相册 */
  async _saveRecordedVideo() {
    const chunks = this.state.recordedChunks;
    if (!chunks || chunks.length === 0) {
      console.warn('[Camera] 无录制数据');
      return;
    }

    try {
      // 合并所有片段为 Blob
      const blob = new Blob(chunks, { type: chunks[0].type || 'video/mp4' });
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const filename = '逆象提词-' + Date.now() + '.' + ext;
      const file = new File([blob], filename, { type: blob.type });

      // 闪屏效果
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999;opacity:0.6;pointer-events:none';
      document.body.appendChild(flash);
      requestAnimationFrame(() => { flash.style.transition = 'opacity 0.35s'; flash.style.opacity = '0'; });
      setTimeout(() => flash.remove(), 400);

      // 使用 navigator.share 保存视频（iOS 15+ WKWebView 兼容）
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '逆象提词录制' });
          console.log('[Camera] 视频已通过分享面板保存');
        } catch (e) {
          if (e.name !== 'AbortError') {
            console.warn('[Camera] 分享失败:', e.message || e);
          }
        }
      } else {
        // 回退：创建 Blob URL 下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        console.log('[Camera] 视频已通过下载链接保存');
      }

    } catch (e) {
      console.warn('[Camera] 保存视频失败:', e.message || e);
    }
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
