# SoundLibraryManager

[简体中文](README.md) | [English](README_EN.md)

SoundLibraryManager is a cross-platform, local sound-effect library manager for video editors and audio professionals. It runs on Windows and macOS and helps users organize local audio files, preserve folder hierarchies, add tags, and find sounds quickly through search, filters, real waveform displays, and instant playback.

The application works entirely offline. It requires no account, uploads no data, and does not copy, move, modify, or delete source audio files. Files found in the library can be dragged directly into the media pool or timeline in DaVinci Resolve and Jianying/CapCut.

## For Regular Users

Regular users do not need Node.js or the source code. Download the package for your system from [Releases](https://github.com/wNe233/SoundLibraryManager/releases):

- macOS Apple Silicon: download `SoundLibraryManager-1.0.0-mac-arm64.dmg`
- Windows x64: download `SoundLibraryManager-1.0.0-win-x64-ready.zip`, extract it, and run `SoundLibraryManager.exe`

The current packages are not commercially code-signed. On first launch, macOS may require approval under System Settings -> Privacy & Security. Windows SmartScreen may show an unknown publisher warning.

## Core Features

- Fully local and offline operation with no account or sign-in
- Import individual audio files or complete folders while preserving subfolders
- Never copy, move, modify, or delete source files
- Real waveforms generated from audio data, with mouse positioning, Space playback, and a live playhead
- Custom tags, favorites, search, sorting, and folder hierarchy management
- Filters for duration shape, frequency range, dynamics, and pitch movement
- Card and list views with configurable card columns
- Content-based duplicate detection with waveform comparison and playback before choosing which file to keep
- Missing source-file detection
- Native file dragging into the media pool or timeline in DaVinci Resolve and Jianying/CapCut
- Configurable local waveform cache with size inspection and cleanup

## Supported Audio Formats

- WAV (`.wav`)
- MP3 (`.mp3`)
- AIFF (`.aiff`, `.aif`)
- M4A (`.m4a`)
- FLAC (`.flac`)

## Local Data

The local library stores file indexes, folder hierarchies, tags, favorites, and analysis results. Waveforms and lightweight recognition results are stored in the `wave-cache` directory. Clearing the cache or removing an item or folder from the library never deletes the source audio.

## Building from Source

This project uses Electron and includes native modules for file dragging. macOS uses Objective-C++ and AppKit. Windows uses C++, OLE `DoDragDrop`, and `CF_HDROP`. Rebuilding these modules from source requires the native toolchain for the target operating system.

The current build targets are macOS Apple Silicon (arm64) and Windows x64.

### 1. Prepare the Environment

Required on all platforms:

- Git
- Node.js 22.12.0 or newer
- npm, included with Node.js

The minimum Node.js version matches the requirement of Electron 42.4.1 used by the current project.

macOS also requires the Xcode Command Line Tools:

```bash
xcode-select --install
```

Windows also requires Visual Studio Build Tools with:

- Desktop development with C++
- Windows SDK
- MSVC x64/x86 build tools

### 2. Clone the Repository

```bash
git clone https://github.com/wNe233/SoundLibraryManager.git
cd SoundLibraryManager
```

### 3. Install Dependencies

The repository includes `package-lock.json`, so the recommended command is:

```bash
npm ci
```

### 4. Start Locally

The repository includes prebuilt native drag modules for macOS arm64 and Windows x64. After installing dependencies, start the application with:

```bash
npm start
```

This script runs `electron .` as configured in `package.json`. The project also provides:

```bash
npm run start:global
```

This script runs `npx electron .`.

After changing native drag code, rebuild it on the target platform.

macOS:

```bash
npm run build:native:drag
```

Windows:

```powershell
.\scripts\build-native-file-drag-win.cmd
```

### 5. Verify and Package

Run the release checks first:

```bash
npm test
```

macOS Apple Silicon DMG:

```bash
npm run build:native:drag
npm run build:mac
```

The output is `dist/SoundLibraryManager-1.0.0-mac-arm64.dmg`.

Windows x64 portable EXE:

```powershell
.\scripts\build-native-file-drag-win.cmd
npm run build:win
```

The output is `dist/SoundLibraryManager-1.0.0-win-x64.exe`.

### package.json Scripts

Every command below comes from the current `scripts` field in `package.json`:

| Command | Purpose |
| --- | --- |
| `npm start` | Start the application with the project-local Electron installation |
| `npm run start:global` | Start the application through `npx electron .` |
| `npm test` | Check JavaScript syntax and verify release files |
| `npm run build:native:mac` | Compile the `native/macos/NativeFileDrag.swift` helper |
| `npm run build:native:drag` | Compile the native file-drag module for the current macOS platform |
| `npm run build:native:drag:cn` | Compile the macOS native drag module through the npmmirror Electron mirror |
| `npm run build:mac` | Build the macOS arm64 DMG |
| `npm run build:win` | Build the Windows x64 portable EXE |
| `npm run build:win:cn` | Build the Windows x64 portable EXE through the npmmirror Electron mirror |
| `npm run build:win-ready` | Create a Windows x64 ready ZIP from an existing local Windows Electron cache |
| `npm run package:win-native-source` | Package the Windows native drag source and build scripts |

For the technical retrospective, see [Sound Effect Manager Development with Codex](docs/Codex音效管理器开发技术分享.docx).
