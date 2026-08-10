# SoundLibraryManager 1.0.0

这是 SoundLibraryManager 的首个正式版本，一款面向影视剪辑师、完全在本地运行的音效素材库。

**快速筛选想要的音效**

软件会在导入时进行轻量离线分析，可以按照时间形态、频率特征、动态变化和音高走势筛选素材。搜索、自定义标签、收藏夹和原始文件夹层级可以与识别条件组合使用，减少在大素材库中反复试听的时间。

**实时波形与声音预览**

每条素材都显示由真实音频生成的波形。鼠标指向波形即可定位，按空格从当前位置播放，播放头实时显示进度。卡片和列表视图都支持即时预览、排序和素材状态反馈。

**直接拖入达芬奇和剪映**

macOS 与 Windows 均使用系统原生文件拖拽。用户可以从素材卡片或列表直接把原始音频拖入达芬奇媒体池、达芬奇时间线或剪映时间线，不需要中转文件。

**其他改进**

- 导入文件或完整文件夹，并保留原始子目录层级
- 按文件内容识别重复音频，支持波形对比和选择保留项
- 缺失文件检测、自定义标签和收藏夹
- 可调整素材库与波形缓存位置，并查看或清理缓存
- 针对大量素材加入分批渲染、目录索引、筛选缓存和搜索防抖

**下载**

- `SoundLibraryManager-1.0.0-mac-arm64.dmg`：适用于 Apple Silicon Mac
- `SoundLibraryManager-1.0.0-win-x64-ready.zip`：适用于 Windows 10/11 x64，解压后运行 `SoundLibraryManager.exe`
- `SoundLibraryManager-1.0.0-source.zip`：完整项目源代码

**安装提示**

当前发布包没有商业代码签名。macOS 首次打开时可能需要在“系统设置 -> 隐私与安全性”中允许；Windows SmartScreen 可能显示未知发布者。

**SHA-256 校验值**

```text
93f8ed1d38c30a7eb924b8a87465a569ae0b945693958849ce2db0fc5b2f4f68  SoundLibraryManager-1.0.0-mac-arm64.dmg
dcbbbffa864d252c25d2f241820a3a34b553b7ef3d05df133d8fc530aac42b6b  SoundLibraryManager-1.0.0-win-x64-ready.zip
```
