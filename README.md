# 音效素材库 SoundLibraryManager

面向影视剪辑师的本地音效管理器。软件不联网、不需要账号、不内置音效，也不会复制或删除原始音频，只在用户选择的位置保存本地索引和波形缓存。

## 创作者

- 袁泉
- OpenAI Codex

袁泉负责产品方向、剪辑工作流定义、设计反馈和跨平台测试；OpenAI Codex 作为联合创作者，参与产品设计、界面实现、Electron 与原生拖拽开发、性能优化、构建和技术文档。

## 1.0 功能

- 中文界面，支持深色和浅色主题
- 导入音频文件或完整文件夹，保留原始子目录层级
- 支持 WAV、MP3、AIFF、AIF、M4A、FLAC
- 卡片和列表双视图，可调整卡片列数并按添加时间、名称、时长、格式排序
- 真实波形、实时播放头、指针定位和空格播放
- 自定义标签、收藏夹和缺失文件检测
- 时间形态、频率特征、动态、音高音调的轻量离线筛选
- 按文件内容识别重复音频，支持分组预览、波形对比和选择保留项
- 右键新建、重命名、移除归类目录，支持框选、Shift 和 Ctrl/Command 多选
- 可更改素材库和波形缓存位置，可查看容量或清理缓存
- macOS 与 Windows 系统原生文件拖拽，可把音频拖入达芬奇或剪映
- 保留“导入到达芬奇媒体池”右键入口
- 大素材库分批渲染、目录索引、筛选缓存和搜索防抖

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm start
```

## 构建

macOS ARM64：

```bash
npm run build:native:drag
npm run build:mac
```

Windows x64 原生拖拽模块必须在 Windows x64 环境中构建：

```powershell
.\scripts\build-native-file-drag-win.cmd
node .\scripts\update-win-unpacked.js
```

发布前检查：

```bash
npm test
```

## 数据与隐私

- 素材库默认保存在系统应用数据目录的 `soundeffect.library` 中
- 用户可以在软件内更改素材库或仅更改波形缓存位置
- `library.json` 保存路径、层级、标签、收藏和分析结果
- `wave-cache` 保存波形和轻量识别缓存
- 清理缓存、移除素材或移除目录都不会删除原始音频
- 软件不包含联网、账号、上传或遥测功能

## 原生拖拽说明

网页和 Electron 的普通拖拽数据不能稳定被专业剪辑软件识别。1.0 使用系统原生文件拖拽：macOS 通过 AppKit 的 `NSDraggingSession`，Windows 通过 OLE `DoDragDrop` 和 `CF_HDROP`。目标软件最终收到的是原始音频文件路径，而不是中转文件。

## 已知限制

- macOS 发布包目前未做 Apple Developer ID 签名和公证，其他 Mac 首次打开时可能需要在系统设置中允许
- Windows 发布包目前未做代码签名，SmartScreen 可能显示未知发布者
- 达芬奇右键导入依赖本机 Resolve 脚本接口；原生拖拽不依赖该接口
- 自动识别属于轻量离线分析，用于快速筛选，不等同于专业音频 AI 识别

技术复盘见 [Codex 音效管理器开发技术分享](docs/Codex音效管理器开发技术分享.docx)。
