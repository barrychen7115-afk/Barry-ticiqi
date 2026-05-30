# 智能提词器 Pro — Capacitor 构建指南

## 你的运行环境

| 电脑 | 手机 |
|------|------|
| Windows | iPhone 13 |

## 整体流程（只需最后一步用 Mac）

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Windows 上完成     │ ──→ │  传文件到 Mac     │ ──→ │  编译装进 iPhone │
│  90% 的开发工作     │     │  (借用/云端/朋友)  │     │                  │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 第一步：在 Windows 上安装 Node.js（已有则跳过）

1. 打开浏览器，访问：https://nodejs.org
2. 下载 **LTS 版本**（左边那个绿色的大按钮）
3. 安装，一路 Next 即可
4. 安装完成后，打开 PowerShell，验证：

```powershell
node --version   # 应显示 v18 或更高
npm --version    # 应显示 v9 或更高
```

---

## 第二步：初始化和运行项目（Windows 上）

在项目目录 `teleprompter-capacitor` 中打开 PowerShell，依次执行：

### 2.1 安装依赖（首次，约 2 分钟）
```powershell
cd C:\Users\chenb\WorkBuddy\2026-05-30-task-3\teleprompter-capacitor
npm install
```

### 2.2 在浏览器里预览（立刻可以看效果）
```powershell
npm start
# 或手动运行：npx serve www -l 3000
```
浏览器打开 http://localhost:3000，就能看到完整的 App 界面。

> 📱 用 Chrome 的 iPhone 模拟器看更真实：按 F12 → 点左上角「设备切换」图标 → 选 iPhone 13。

### 2.3 确认一切正常后，构建 Web 资源
```powershell
npm run build
```

---

## 第三步：在 Mac 上打包（只需几分钟）

这是唯一需要用 Mac 的步骤。选一种方式：

### 方式 A：借用朋友/公司的 Mac（最快）

1. 把整个 `teleprompter-capacitor` 文件夹复制到 Mac
2. 打开终端（Terminal），进入该目录：

```bash
cd ~/Desktop/teleprompter-capacitor

# 安装依赖
npm install

# 安装 iOS 平台（首次）
npx cap add ios

# 同步 Web 资源到 iOS 工程
npx cap sync

# 打开 Xcode
npx cap open ios
```

3. Xcode 打开后：
   - 左上角选择 Team（用你的 Apple ID 登录，免费的就可以）
   - 左上角设备选你的 iPhone（用数据线连接）
   - 点 ▶ 运行按钮
   - **首次运行需要在 iPhone 上：设置 → 通用 → VPN与设备管理 → 信任证书**

### 方式 B：云端 Mac（无需实体 Mac）

macOS 云服务（按小时付费，编译一次约 ¥5-20）：

| 服务商 | 地址 | 价格 |
|--------|------|------|
| **MacinCloud** | macincloud.com | 约 $1/小时 |
| **MacStadium** | macstadium.com | 按小时计费 |
| **AWS EC2 Mac** | aws.amazon.com | 约 $1.08/小时 |

流程和方式 A 完全一样，只是通过远程桌面连接到云 Mac 操作。

---

## 权限说明（给 Mac 操作者）

项目 `Info.plist` 已配置好下面三项，编译时 Xcode 会自动带上：

| 权限 | 说明 |
|------|------|
| `NSMicrophoneUsageDescription` | 「智能提词器需要访问麦克风，用于 AI 语音识别」 |
| `NSSpeechRecognitionUsageDescription` | 「智能提词器使用语音识别技术，自动追踪朗读位置」 |
| `NSCameraUsageDescription` | 「智能提词器在拍摄时显示悬浮提词窗口」 |

---

## 文件结构

```
teleprompter-capacitor/
├── package.json              # npm 项目配置
├── capacitor.config.ts       # Capacitor 配置
├── .gitignore
├── www/                      # Web 资源（你在浏览器看到的）
│   ├── index.html            # 主页面
│   ├── css/
│   │   └── style.css         # 所有样式
│   └── js/
│       └── app.js            # 所有逻辑（AI跟读、浮动窗、颜色等）
├── ios/                      # iOS 工程（npx cap add ios 后生成）
└── node_modules/             # 依赖包（npm install 后生成）
```

---

## 常见问题

### Q: 要付 Apple 开发者费用吗？
**不需要。**Apple 免费 Apple ID 就能在真机上安装自己的 App（有效期 7 天，重装可续）。

### Q: Web Speech API 在 iPhone 上能用吗？
**能。**iOS 14+ 的 Safari 和 WKWebView 都支持 `webkitSpeechRecognition`，项目代码已做了兼容处理。

### Q: 相机预览怎么显示？
项目使用 HTML5 `getUserMedia` 获取前置摄像头画面作为提词窗口的底层背景。首次使用会弹出权限请求，点「允许」即可。

### Q: 如果语音识别出错怎么办？
代码内置了自动重启机制——iOS Speech API 有约 1 分钟的时间限制，App 会无感知地自动重新开始识别。

---

## 更新日志

- **v1.0.0** — 初始版本：悬浮窗 + 颜色/字号/透明度控制 + AI 跟读 + 相机预览
