# 智能提词器 Pro - iPhone 打包安装指南

## 总览

整个流程 **零成本、全程在 Windows 上操作**：

| 步骤 | 在哪操作 | 耗时 |
|------|----------|------|
| 1. 创建 GitHub 仓库 | 网页 | 2 分钟 |
| 2. 推送项目代码 | Windows 命令行 | 1 分钟 |
| 3. GitHub Actions 自动打包 | GitHub 云端 | 8-15 分钟 |
| 4. 下载 .ipa 文件 | 网页 | 1 分钟 |
| 5. Sideloadly 安装到 iPhone | Windows | 3 分钟 |

---

## 第一步：创建 GitHub 仓库

1. 打开 [github.com](https://github.com) 并登录（没有账号的话免费注册一个）
2. 点击右上角 **+** → **New repository**
3. 填写：
   - Repository name: `teleprompter-pro`（或任意名字）
   - Description: 智能提词器 iPhone App
   - **选择 Public（公开）**← 公开仓库 macOS 打包完全免费
   - 不要勾选 "Add a README file"（我们已有自己的文件）
4. 点击 **Create repository**
5. 创建后会显示一个页面，上面有类似这样的命令，记下来备用：

```bash
git remote add origin https://github.com/你的用户名/teleprompter-pro.git
git branch -M main
git push -u origin main
```

---

## 第二步：推送项目到 GitHub

在 Windows 上打开终端（PowerShell 或 Git Bash），依次执行：

```bash
# 进入项目目录
cd C:\Users\chenb\WorkBuddy\2026-05-30-task-3\teleprompter-capacitor

# 初始化 Git（如果还没初始化）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: 智能提词器 Pro"

# 关联 GitHub 仓库（替换为你的地址）
git remote add origin https://github.com/你的用户名/teleprompter-pro.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

> 💡 如果提示需要登录，在浏览器中登录 GitHub 后，可以用 `gh auth login` 授权，或者使用 Personal Access Token。

推送成功后，GitHub Actions 会**自动开始构建**！

---

## 第三步：查看构建进度

1. 打开你的 GitHub 仓库页面：`https://github.com/你的用户名/teleprompter-pro`
2. 点击顶部 **Actions** 标签
3. 你会看到名为 **"Build iOS IPA"** 的工作流正在运行
4. 点击进去可以看实时日志

正常情况下 8-15 分钟完成。如果失败，把日志截图发给我。

---

## 第四步：下载 .ipa 文件

1. 构建成功后，在 Actions 页面点击该次构建
2. 滚动到底部，找到 **Artifacts** 区域
3. 点击 **teleprompter-pro** 下载 `.zip` 文件
4. 解压得到 `teleprompter-pro.ipa`

---

## 第五步：安装 Sideloadly（仅首次）

1. 打开 [sideloadly.io](https://sideloadly.io)
2. 下载 **Windows 64-bit** 版本
3. 安装并打开 Sideloadly

> ⚠️ 电脑上需要安装 **iTunes** 和 **iCloud**（从苹果官网下载，**不要**从 Microsoft Store 下载）
> - iTunes: https://www.apple.com/itunes/download/win64
> - iCloud: https://support.apple.com/zh-cn/HT204283

---

## 第六步：安装到 iPhone 13

1. 用 **USB 数据线** 将 iPhone 13 连接到 Windows 电脑
2. iPhone 上弹出"信任此电脑？"→ 点 **信任**，输入手机密码
3. 打开 Sideloadly
4. 将 `teleprompter-pro.ipa` 拖入 Sideloadly 窗口
5. 输入你的 **Apple ID**（就是 iPhone 上登录的那个账号）
6. 点击 **Start** 开始安装
7. 等 1-2 分钟，App 就会出现在 iPhone 桌面上

---

## 首次打开 App 的额外步骤

安装后第一次打开会提示"未受信任的开发者"：

1. iPhone 上打开 **设置** → **通用** → **VPN 与设备管理**
2. 找到你的 Apple ID 邮箱
3. 点击 **信任 "你的邮箱"**
4. 再次点击 App 图标即可正常打开

> 这个信任操作**只需要做一次**。

---

## 关于 7 天重新签名

免费 Apple ID 签名的 App 有效期只有 **7 天**。7 天后 App 会无法打开。

**自动续签方案**（推荐）：
- Sideloadly 有一个 **Auto-Refresh** 功能
- iPhone 和电脑在同一个 WiFi 下时，Sideloadly 会自动在后台重新签名
- **完全无感，不需要手动操作**

使用方法：
1. Sideloadly 中勾选 **"Automatically refresh"**
2. 保持 Sideloadly 在后台运行
3. iPhone 和电脑连接同一 WiFi 即可

---

## 更新 App 的方式

当你修改了代码（比如调整了提词器样式），需要更新手机上 App：

1. 在项目目录执行：
```bash
git add .
git commit -m "更新了xxx功能"
git push
```

2. GitHub Actions 会自动重新打包
3. 去 Actions 下载新的 `.ipa`
4. 用 Sideloadly 重新安装（覆盖旧版本，数据保留）

---

## 常见问题

### Q: GitHub Actions 构建失败了？
把 Actions 日志截图发给我，我帮你排查。通常是网络问题或依赖版本问题。

### Q: Sideloadly 提示 "Unable to sign"？
检查：
- iPhone 是否已解锁并信任了电脑
- Apple ID 和密码是否正确
- iTunes 和 iCloud 是否已安装

### Q: 能不能不用 USB 线？
可以。第一次用 USB 安装后，打开 Sideloadly 的 **WiFi Sideload** 功能，之后只要同一 WiFi 就能无线安装。

### Q: 想上架 App Store 怎么办？
需要 $99/年的 Apple Developer 付费账号。在云 Mac 或朋友 Mac 上用 Xcode 正式打包后提交 App Store Connect 审核。

---

## 费用清单

| 项目 | 费用 |
|------|------|
| GitHub 账号 | 免费 |
| GitHub Actions（公开仓库） | 免费 |
| Sideloadly | 免费 |
| Apple ID | 免费 |
| iTunes + iCloud | 免费 |
| **总计** | **¥0** |
