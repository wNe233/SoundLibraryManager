# SoundLibraryManager 音效素材库

[简体中文](README.md) | [English](README_EN.md)

SoundLibraryManager 是一款面向剪辑师和音频从业者的跨平台本地音效素材库管理工具，支持 Windows 和 macOS。它用于整理本机音频素材、保留文件夹层级、添加标签，并通过搜索、筛选、真实波形和即时试听快速找到需要的声音。

软件完全离线运行，不需要账号，不上传数据，也不会复制、移动、修改或删除原始音频文件。找到素材后，可以直接将原始文件拖入达芬奇或剪映的媒体池和时间线。

## 普通用户使用

普通用户不需要安装 Node.js，也不需要下载源码。请前往 [Releases](https://github.com/wNe233/SoundLibraryManager/releases) 下载对应系统的安装包：

- macOS Apple Silicon：下载 `mac-arm64.dmg`
- Windows x64：下载 `win-x64.exe`

当前发布包没有商业代码签名。macOS 首次打开时可能需要在“系统设置 -> 隐私与安全性”中允许；Windows SmartScreen 可能提示未知发布者。

## 核心功能

- 完全本地、离线运行，不需要联网或登录
- 导入音频文件或完整文件夹，并保留原始子目录层级
- 不复制、不移动、不修改、不删除原始文件
- 根据真实音频数据生成波形，支持鼠标定位、空格播放和实时播放头
- 自定义标签、收藏夹、搜索、排序和文件夹层级管理
- 按时间形态、频率特征、动态变化和音高走势筛选音效
- 卡片和列表两种视图，支持调整卡片列数
- 按文件内容识别重复音频，并通过波形和试听选择保留项
- 检测原始文件是否缺失
- 通过原生文件拖拽将音频放入达芬奇或剪映的媒体池和时间线
- 可查看、更改或清理本地波形缓存

## 支持的音频格式

- WAV（`.wav`）
- MP3（`.mp3`）
- AIFF（`.aiff`、`.aif`）
- M4A（`.m4a`）
- FLAC（`.flac`）

## 本地数据

素材索引、文件夹层级、标签、收藏和分析结果保存在本地素材库中，波形与轻量识别结果保存在 `wave-cache` 缓存目录中。清理缓存、移除素材或移除目录都不会删除原始音频。

## 开发者源码构建

本项目使用 Electron。拖拽功能包含原生模块：macOS 使用 Objective-C++ 与 AppKit，Windows 使用 C++、OLE `DoDragDrop` 和 `CF_HDROP`。从源码重新编译原生模块时，必须在目标系统上安装对应工具链。

当前构建目标为 macOS Apple Silicon（arm64）和 Windows x64。

### 1. 环境准备

通用环境：

- Git
- Node.js 22.12.0 或更高版本
- npm（随 Node.js 安装）

Node.js 最低版本与项目当前使用的 Electron 42.4.1 要求一致。

macOS 还需要 Xcode 命令行工具：

```bash
xcode-select --install
```

Windows 还需要 Visual Studio Build Tools，并安装：

- Desktop development with C++
- Windows SDK
- MSVC x64/x86 build tools

### 2. 克隆仓库

```bash
git clone https://github.com/wNe233/SoundLibraryManager.git
cd SoundLibraryManager
```

### 3. 安装依赖

项目包含 `package-lock.json`，建议使用：

```bash
npm ci
```

### 4. 本地启动

仓库已包含 macOS arm64 和 Windows x64 的原生拖拽预编译文件。安装依赖后可直接启动：

```bash
npm start
```

该命令对应 `package.json` 中的 `electron .`。也可以运行项目已配置的：

```bash
npm run start:global
```

它对应 `npx electron .`。

修改原生拖拽代码后，需要在目标平台重新编译。

macOS：

```bash
npm run build:native:drag
```

Windows：

```powershell
.\scripts\build-native-file-drag-win.cmd
```

### 5. 检查与打包构建

先执行发布检查：

```bash
npm test
```

macOS Apple Silicon DMG：

```bash
npm run build:native:drag
npm run build:mac
```

输出文件位于 `dist/SoundLibraryManager-1.0.0-mac-arm64.dmg`。

Windows x64 便携版 EXE：

```powershell
.\scripts\build-native-file-drag-win.cmd
npm run build:win
```

输出文件位于 `dist/SoundLibraryManager-1.0.0-win-x64.exe`。

### package.json 脚本

以下命令均来自当前 `package.json` 的 `scripts` 字段：

| 命令 | 实际用途 |
| --- | --- |
| `npm start` | 使用项目内 Electron 启动应用 |
| `npm run start:global` | 通过 `npx electron .` 启动应用 |
| `npm test` | 检查 JavaScript 语法并运行发布文件验证 |
| `npm run build:native:mac` | 编译 `native/macos/NativeFileDrag.swift` 辅助程序 |
| `npm run build:native:drag` | 为当前 macOS 平台编译原生文件拖拽模块 |
| `npm run build:native:drag:cn` | 使用 npmmirror Electron 镜像编译 macOS 原生拖拽模块 |
| `npm run build:mac` | 构建 macOS arm64 DMG |
| `npm run build:win` | 构建 Windows x64 便携版 EXE |
| `npm run build:win:cn` | 使用 npmmirror Electron 镜像构建 Windows x64 便携版 EXE |
| `npm run build:win-ready` | 使用本机已有的 Windows Electron 缓存生成 Windows x64 ready ZIP |
| `npm run package:win-native-source` | 打包 Windows 原生拖拽模块源码与构建脚本 |

技术复盘见 [Codex 音效管理器开发技术分享](docs/Codex音效管理器开发技术分享.docx)。
