const STORAGE_KEY = 'sound-library-manager:v2';
const LEGACY_STORAGE_KEY = 'sound-library-manager:v1';

const FILTERS = [
  ['shape', '时间形态', ['长音', '短音']],
  ['frequency', '频率特征', ['低频', '中频', '高频']],
  ['dynamics', '动态', ['渐强', '突强', '渐弱', '突弱', '平稳']],
  ['pitch', '音高音调', ['升调', '降调', '平稳']]
];

const state = {
  sounds: [],
  folders: [{ id: 'all', name: '全部素材', parentId: null, system: true }],
  selectedId: null,
  selectedFolder: 'all',
  query: '',
  filters: {},
  tagFilter: '',
  viewMode: 'card',
  cardColumns: 'auto',
  sortMode: 'added-desc',
  audio: null,
  platform: 'darwin',
  isPlaying: false,
  playheadTime: 0,
  hoverTime: null,
  hoverSoundId: null,
  previewId: null,
  activeContextId: null,
  activeFolderId: 'all',
  selectedFolderIds: new Set(),
  lastFolderClickId: 'all',
  duplicateDialogOpen: false,
  duplicateGroups: [],
  duplicateActiveHash: '',
  duplicateAudio: null,
  folderDragSelect: null,
  openFilter: null,
  pendingDialog: null,
  analyzing: false,
  analysisDone: 0,
  analysisTotal: 0,
  workOverlay: {
    visible: false,
    title: '',
    message: '',
    done: 0,
    total: 0
  },
  checkingMissing: false,
  lastWaveFrame: 0,
  lastRenderedKey: '',
  waveStartedAt: performance.now(),
  renderLimit: 120,
  soundById: new Map(),
  folderById: new Map(),
  folderChildrenByParent: new Map(),
  folderDescendantsById: new Map(),
  folderCountById: new Map(),
  favoriteCount: 0,
  missingCount: 0,
  indexVersion: 0,
  filterCacheKey: '',
  filterCacheResult: [],
  searchTimer: null
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  bindElements();
  initializeApp();
});

async function initializeApp() {
  state.platform = await window.soundLibrary.platform();
  document.body.dataset.platform = state.platform;
  await restoreState();
  renderFilters();
  bindEvents();
  renderAll(true);
  checkMissingFiles({ silent: true, limit: 120 });
  analyzePending();
  tick();
}

function bindElements() {
  Object.assign(els, {
    app: document.querySelector('#app'),
    themeToggle: document.querySelector('#themeToggle'),
    importFolderBtn: document.querySelector('#importFolderBtn'),
    importFilesBtn: document.querySelector('#importFilesBtn'),
    dropZone: document.querySelector('#dropZone'),
    folderTree: document.querySelector('#folderTree'),
    collapseAllBtn: document.querySelector('#collapseAllBtn'),
    searchInput: document.querySelector('#searchInput'),
    filters: document.querySelector('#filters'),
    tagFilters: document.querySelector('#tagFilters'),
    duplicateScanBtn: document.querySelector('#duplicateScanBtn'),
    clearFiltersBtn: document.querySelector('#clearFiltersBtn'),
    cardViewBtn: document.querySelector('#cardViewBtn'),
    listViewBtn: document.querySelector('#listViewBtn'),
    columnToggle: document.querySelector('.column-toggle'),
    sortSelect: document.querySelector('#sortSelect'),
    statCount: document.querySelector('#statCount'),
    soundList: document.querySelector('#soundList'),
    previewTitle: document.querySelector('#previewTitle'),
    revealBtn: document.querySelector('#revealBtn'),
    largeWaveWrap: document.querySelector('#largeWaveWrap'),
    largeWave: document.querySelector('#largeWave'),
    emptyWave: document.querySelector('#emptyWave'),
    playBtn: document.querySelector('#playBtn'),
    currentTime: document.querySelector('#currentTime'),
    durationTime: document.querySelector('#durationTime'),
    tagInput: document.querySelector('#tagInput'),
    customTags: document.querySelector('#customTags'),
    analysisGrid: document.querySelector('#analysisGrid'),
    metaPath: document.querySelector('#metaPath'),
    metaFolder: document.querySelector('#metaFolder'),
    metaFormat: document.querySelector('#metaFormat'),
    metaStatus: document.querySelector('#metaStatus'),
    libraryPath: document.querySelector('#libraryPath'),
    cacheSize: document.querySelector('#cacheSize'),
    cachePath: document.querySelector('#cachePath'),
    chooseLibraryBtn: document.querySelector('#chooseLibraryBtn'),
    chooseCacheBtn: document.querySelector('#chooseCacheBtn'),
    clearCacheBtn: document.querySelector('#clearCacheBtn'),
    contextMenu: document.querySelector('#contextMenu'),
    folderContextMenu: document.querySelector('#folderContextMenu'),
    folderMarquee: document.querySelector('#folderMarquee'),
    nameDialog: document.querySelector('#nameDialog'),
    nameDialogTitle: document.querySelector('#nameDialogTitle'),
    nameDialogInput: document.querySelector('#nameDialogInput'),
    nameCancelBtn: document.querySelector('#nameCancelBtn'),
    nameConfirmBtn: document.querySelector('#nameConfirmBtn'),
    duplicateDialog: document.querySelector('#duplicateDialog'),
    duplicateDialogTitle: document.querySelector('#duplicateDialogTitle'),
    duplicateCloseBtn: document.querySelector('#duplicateCloseBtn'),
    duplicateGroupList: document.querySelector('#duplicateGroupList'),
    duplicatePreviewEmpty: document.querySelector('#duplicatePreviewEmpty'),
    duplicatePreviewContent: document.querySelector('#duplicatePreviewContent'),
    duplicateGroupCount: document.querySelector('#duplicateGroupCount'),
    duplicateGroupName: document.querySelector('#duplicateGroupName'),
    duplicateKeepOldestBtn: document.querySelector('#duplicateKeepOldestBtn'),
    duplicateCandidates: document.querySelector('#duplicateCandidates'),
    workOverlay: document.querySelector('#workOverlay'),
    workTitle: document.querySelector('#workTitle'),
    workMessage: document.querySelector('#workMessage'),
    workProgressBar: document.querySelector('#workProgressBar'),
    workProgressText: document.querySelector('#workProgressText'),
    toast: document.querySelector('#toast')
  });
}

function bindEvents() {
  els.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('sound-library-theme', document.body.classList.contains('light') ? 'light' : 'dark');
    repaintWaves();
  });

  els.importFolderBtn.addEventListener('click', async () => {
    await withLibraryWork('正在导入文件夹', '正在扫描文件夹并建立本地索引', async () => {
      setWorkProgress(0, 1, '等待选择文件夹');
      const result = await window.soundLibrary.chooseFolder();
      if (!result.files.length) {
        toast('没有找到支持的音频文件');
        return;
      }
      const summary = await addSounds(result.files);
      toast(importSummaryText(summary));
    });
  });

  els.importFilesBtn.addEventListener('click', async () => {
    await withLibraryWork('正在导入音效', '正在读取文件并生成波形缓存', async () => {
      setWorkProgress(0, 1, '等待选择文件');
      const files = await window.soundLibrary.chooseAudioFiles();
      if (!files.length) return;
      const summary = await addSounds(files);
      toast(importSummaryText(summary));
    });
  });

  bindDropTarget(document);
  bindDropTarget(els.dropZone);

  els.searchInput.addEventListener('input', (event) => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      state.query = event.target.value.trim().toLowerCase();
      renderLibrary(true);
    }, 120);
  });

  els.clearFiltersBtn.addEventListener('click', () => {
    state.filters = {};
    state.tagFilter = '';
    state.query = '';
    state.selectedFolder = 'all';
    els.searchInput.value = '';
    renderAll(true);
  });

  els.collapseAllBtn.addEventListener('click', () => {
    state.selectedFolder = 'all';
    renderAll(true);
  });

  els.cardViewBtn.addEventListener('click', () => setViewMode('card'));
  els.listViewBtn.addEventListener('click', () => setViewMode('list'));
  els.columnToggle.addEventListener('click', (event) => {
    const button = event.target.closest('[data-columns]');
    if (!button) return;
    state.cardColumns = button.dataset.columns;
    saveState();
    renderLibrary(true);
    updateColumnButtons();
  });
  els.sortSelect.addEventListener('change', () => {
    state.sortMode = els.sortSelect.value;
    saveState();
    renderLibrary(true);
  });
  els.soundList.addEventListener('scroll', maybeExtendRenderedSounds, { passive: true });
  els.chooseLibraryBtn.addEventListener('click', async () => {
    const info = await window.soundLibrary.chooseLibraryDir();
    if (!info) return;
    await refreshCacheInfo(info);
    saveState();
    toast('已更改素材库位置');
  });
  els.chooseCacheBtn.addEventListener('click', async () => {
    const dir = await window.soundLibrary.chooseWaveCacheDir();
    if (dir) {
      toast('已更改缓存位置');
      refreshCacheInfo();
    }
  });
  els.clearCacheBtn.addEventListener('click', async () => {
    await window.soundLibrary.clearWaveCache();
    state.sounds.forEach((sound) => {
      sound.peaks = [];
      sound.duration = 0;
      sound.analysis = { shape: '识别中', frequency: '识别中', dynamics: '识别中', pitch: '识别中' };
    });
    saveState();
    renderAll(true);
    await analyzePending({ showOverlay: true, title: '正在重建波形缓存', message: '正在重新分析音频波形和筛选特征' });
    refreshCacheInfo();
    toast('已清理波形缓存并开始重新分析');
  });
  els.duplicateScanBtn.addEventListener('click', () => scanDuplicates({ manual: true }));
  els.duplicateCloseBtn.addEventListener('click', closeDuplicateDialog);
  els.duplicateKeepOldestBtn.addEventListener('click', () => {
    const group = activeDuplicateGroup();
    if (group) resolveDuplicateGroup(group.hash, group.keepId);
  });

  els.playBtn.addEventListener('click', () => togglePlay());

  bindWaveScrub(els.largeWaveWrap, () => getPreviewSound(), true);

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    event.preventDefault();
    togglePlay();
  });

  els.tagInput.addEventListener('input', autoGrowTagInput);
  els.tagInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    const selected = getPreviewSound();
    const tags = splitTags(els.tagInput.value);
    if (!selected || !tags.length) return;
    selected.tags = [...new Set([...(selected.tags || []), ...tags])];
    els.tagInput.value = '';
    autoGrowTagInput();
    saveState();
    renderAll(true);
    toast(`已添加 ${tags.length} 个标签`);
  });

  els.revealBtn.addEventListener('click', () => {
    const selected = getPreviewSound();
    if (selected) window.soundLibrary.revealFile(selected.path);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.filter-group')) {
      state.openFilter = null;
      renderFilters();
    }
    if (!event.target.closest('.context-menu')) hideContextMenus();
  });

  els.contextMenu.addEventListener('click', handleSoundContextAction);
  els.folderContextMenu.addEventListener('click', handleFolderContextAction);
  els.nameCancelBtn.addEventListener('click', closeNameDialog);
  els.nameConfirmBtn.addEventListener('click', confirmNameDialog);
  els.nameDialogInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') confirmNameDialog();
    if (event.key === 'Escape') closeNameDialog();
  });
  els.duplicateDialog.addEventListener('click', (event) => {
    if (event.target === els.duplicateDialog) closeDuplicateDialog();
  });

  ['dragend', 'drop', 'mouseup', 'mouseleave'].forEach((eventName) => {
    document.addEventListener(eventName, clearDraggingState);
  });
  window.addEventListener('blur', clearDraggingState);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearDraggingState();
  });
}

function bindDropTarget(target) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    target.addEventListener(eventName, (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      els.dropZone.classList.add('drag-over');
    });
  });
  target.addEventListener('dragleave', () => els.dropZone.classList.remove('drag-over'));
  target.addEventListener('drop', async (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    els.dropZone.classList.remove('drag-over');
    await withLibraryWork('正在导入拖入素材', '正在扫描文件和文件夹层级', async () => {
      const paths = [...event.dataTransfer.files].map((file) => window.soundLibrary.pathForFile(file)).filter(Boolean);
      setWorkProgress(0, Math.max(paths.length, 1), '正在读取拖入内容');
      const files = await window.soundLibrary.scanDroppedPaths(paths);
      if (!files.length) {
        toast('没有找到支持的音频文件');
        return;
      }
      const summary = await addSounds(files);
      toast(importSummaryText(summary));
    });
  });
}

function bindWaveScrub(element, getSound, isInspector = false) {
  element.addEventListener('mousemove', (event) => {
    const sound = getSound(event);
    if (!sound?.duration) return;
    const hoverTime = pointerTime(event, element, sound.duration);
    setPreviewSound(sound.id, false);
    state.hoverSoundId = sound.id;
    state.hoverTime = hoverTime;
    if (isInspector) drawLargeWave(sound);
    else drawItemWave(sound.id);
  });
  element.addEventListener('mouseleave', () => {
    const sound = getSound();
    state.hoverSoundId = null;
    state.hoverTime = null;
    if (isInspector) drawLargeWave(sound);
    else if (sound) drawItemWave(sound.id);
  });
  element.addEventListener('click', (event) => {
    const sound = getSound(event);
    if (!sound?.duration) return;
    setPreviewSound(sound.id, false);
    state.playheadTime = pointerTime(event, element, sound.duration);
    if (state.audio && state.audio.dataset.id === sound.id) state.audio.currentTime = state.playheadTime;
    renderInspector();
    drawItemWave(sound.id);
  });
  element.addEventListener('dblclick', (event) => {
    const sound = getSound(event);
    if (!sound) return;
    setPreviewSound(sound.id, false);
    togglePlay();
  });
}

async function restoreState() {
  const savedTheme = localStorage.getItem('sound-library-theme');
  if (savedTheme === 'light') document.body.classList.add('light');
  try {
    const stored = await window.soundLibrary.loadLibrary();
    const saved = stored || JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || '{}');
    state.sounds = Array.isArray(saved.sounds) ? saved.sounds.map(normalizeSound) : [];
    state.folders = normalizeFolders(saved.folders);
    rebuildIndexes();
    migrateImportedFolders();
    rebuildIndexes();
    repairFolderState();
    rebuildIndexes();
    state.selectedId = saved.selectedId || state.sounds[0]?.id || null;
    state.previewId = state.selectedId;
    state.selectedFolder = folderExists(saved.selectedFolder) ? saved.selectedFolder : 'all';
    state.viewMode = saved.viewMode || 'card';
    state.cardColumns = saved.cardColumns || 'auto';
    state.sortMode = saved.sortMode || 'added-desc';
  } catch {
    state.sounds = [];
    rebuildIndexes();
  }
}

function normalizeSound(sound) {
  return {
    ...sound,
    contentHash: sound.contentHash || '',
    favorite: Boolean(sound.favorite),
    missing: Boolean(sound.missing),
    missingCheckedAt: sound.missingCheckedAt || 0,
    libraryFolderId: sound.libraryFolderId || 'all',
    tags: Array.isArray(sound.tags) ? sound.tags : [],
    analysis: {
      shape: sound.analysis?.shape || '未识别',
      frequency: sound.analysis?.frequency || '未识别',
      dynamics: sound.analysis?.dynamics || '未识别',
      pitch: sound.analysis?.pitch || '未识别'
    }
  };
}

function normalizeFolders(folders) {
  const source = Array.isArray(folders) ? folders : [];
  const normalized = source.filter((folder) => folder.id !== 'all' && !folder.id?.startsWith('path:'));
  return [{ id: 'all', name: '全部素材', parentId: null, system: true }, ...normalized];
}

function migrateImportedFolders() {
  state.sounds.forEach((sound) => {
    if (!sound.folderRoot || !sound.relativePath || sound.libraryFolderId !== 'all') return;
    const parts = sound.relativePath.split(/[\\/]/).slice(0, -1);
    sound.libraryFolderId = ensureManagedFolderPath(sound.folderRoot, parts);
  });
}

function librarySnapshot() {
  const slimSounds = state.sounds.map((sound) => ({ ...sound, audioBuffer: undefined }));
  return {
    sounds: slimSounds,
    folders: state.folders,
    selectedId: state.selectedId,
    selectedFolder: state.selectedFolder,
    viewMode: state.viewMode,
    cardColumns: state.cardColumns,
    sortMode: state.sortMode
  };
}

function saveState() {
  const snapshot = librarySnapshot();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selectedId: snapshot.selectedId,
    selectedFolder: snapshot.selectedFolder,
    viewMode: snapshot.viewMode,
    cardColumns: snapshot.cardColumns,
    sortMode: snapshot.sortMode
  }));
  window.soundLibrary.saveLibrary(snapshot).catch(() => {});
}

function rebuildIndexes() {
  state.soundById = new Map(state.sounds.map((sound) => [sound.id, sound]));
  state.folderById = new Map(state.folders.map((folder) => [folder.id, folder]));
  state.folderChildrenByParent = new Map();
  state.folderDescendantsById = new Map();
  state.folderCountById = new Map();
  state.favoriteCount = 0;
  state.missingCount = 0;
  state.indexVersion += 1;
  state.filterCacheKey = '';
  state.filterCacheResult = [];

  state.folders.forEach((folder) => {
    const parentId = folder.parentId || 'all';
    if (!state.folderChildrenByParent.has(parentId)) state.folderChildrenByParent.set(parentId, []);
    if (folder.id !== 'all') state.folderChildrenByParent.get(parentId).push(folder);
  });
  state.folderChildrenByParent.forEach((children) => {
    children.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  });

  state.folders.forEach((folder) => {
    state.folderDescendantsById.set(folder.id, collectFolderDescendantsIndexed(folder.id));
    state.folderCountById.set(folder.id, 0);
  });

  state.sounds.forEach((sound) => {
    if (sound.favorite) state.favoriteCount += 1;
    if (sound.missing) state.missingCount += 1;
    let folderId = sound.libraryFolderId || 'all';
    while (folderId && state.folderById.has(folderId)) {
      state.folderCountById.set(folderId, (state.folderCountById.get(folderId) || 0) + 1);
      folderId = state.folderById.get(folderId)?.parentId;
    }
  });
}

function collectFolderDescendantsIndexed(folderId) {
  const direct = state.folderChildrenByParent.get(folderId) || [];
  return direct.flatMap((folder) => [folder.id, ...collectFolderDescendantsIndexed(folder.id)]);
}

function repairFolderState() {
  state.sounds.forEach((sound) => {
    if (!folderExists(sound.libraryFolderId)) sound.libraryFolderId = 'all';
  });
  if (state.selectedFolder === 'missing' && !state.sounds.some((sound) => sound.missing)) {
    state.selectedFolder = 'all';
  }
}

function folderExists(folderId) {
  return isSystemFolder(folderId) || state.folderById.has(folderId);
}

async function addSounds(files) {
  const existing = new Set(state.sounds.map((sound) => sound.path));
  const seenIncoming = new Set();
  const incoming = files.filter((file) => {
    if (existing.has(file.path) || seenIncoming.has(file.path)) return false;
    seenIncoming.add(file.path);
    return true;
  });
  const hashCounts = new Map();
  state.sounds.forEach((sound) => {
    if (sound.contentHash) hashCounts.set(sound.contentHash, (hashCounts.get(sound.contentHash) || 0) + 1);
  });
  incoming.forEach((file) => {
    if (file.contentHash) hashCounts.set(file.contentHash, (hashCounts.get(file.contentHash) || 0) + 1);
  });
  const duplicateHashes = new Set(incoming.map((file) => file.contentHash).filter((hash) => hash && hashCounts.get(hash) > 1));
  const startTime = Date.now();
  state.sounds.push(...incoming.map((file) => normalizeSound({
    ...file,
    addedAt: startTime,
    duration: 0,
    peaks: [],
    tags: [],
    libraryFolderId: targetFolderForImportedFile(file),
    analysis: {
      shape: '识别中',
      frequency: '识别中',
      dynamics: '识别中',
      pitch: '识别中'
    }
  })));
  rebuildIndexes();
  if (!state.selectedId && state.sounds[0]) state.selectedId = state.sounds[0].id;
  saveState();
  renderAll(true);
  await analyzePending({
    soundIds: incoming.map((file) => file.path),
    showOverlay: true,
    title: '正在建立素材库缓存',
    message: incoming.length ? `正在分析 ${incoming.length} 个音效的真实波形` : '没有新增音效需要分析'
  });
  if (duplicateHashes.size) {
    openDuplicateDialog([...duplicateHashes]);
  }
  return {
    added: incoming.length,
    skipped: files.length - incoming.length,
    duplicateGroups: duplicateHashes.size
  };
}

function importSummaryText(summary) {
  const parts = [`已导入 ${summary.added} 个音效`];
  if (summary.skipped) parts.push(`跳过 ${summary.skipped} 个已存在文件`);
  if (summary.duplicateGroups) parts.push(`发现 ${summary.duplicateGroups} 组重复`);
  return parts.join('，');
}

function targetFolderForImportedFile(file) {
  const parts = file.relativePath?.split(/[\\/]/).slice(0, -1) || [];
  return ensureManagedFolderPath(file.folderRoot, parts);
}

function ensureManagedFolderPath(rootPath, relativeParts = []) {
  if (!rootPath) return 'all';
  const rootId = `import:${rootPath}`;
  let rootFolder = state.folders.find((folder) => folder.id === rootId);
  if (!rootFolder) {
    rootFolder = {
      id: rootId,
      name: rootPath.split(/[\\/]/).filter(Boolean).pop() || '导入文件夹',
      parentId: 'all',
      sourcePath: rootPath
    };
    state.folders.push(rootFolder);
  }

  let parentId = rootId;
  let cursor = '';
  relativeParts.forEach((part) => {
    cursor = cursor ? `${cursor}/${part}` : part;
    const id = `import:${rootPath}:${cursor}`;
    if (!state.folders.some((folder) => folder.id === id)) {
      state.folders.push({
        id,
        name: part,
        parentId,
        sourcePath: rootPath,
        relativePath: cursor
      });
    }
    parentId = id;
  });
  rebuildIndexes();
  return parentId;
}

async function analyzePending(options = {}) {
  if (state.analyzing) {
    state.analysisQueued = true;
    if (options.showOverlay) {
      showWorkOverlay(options.title || '正在建立素材库缓存', '正在等待当前缓存任务完成');
      setWorkProgress(0, 1, '等待当前分析结束');
      await state.analysisPromise;
      return analyzePending(options);
    }
    return state.analysisPromise;
  }
  state.analysisPromise = runAnalyzePending(options);
  try {
    return await state.analysisPromise;
  } finally {
    const shouldRunQueued = state.analysisQueued;
    state.analysisQueued = false;
    state.analysisPromise = null;
    if (shouldRunQueued) analyzePending();
  }
}

async function runAnalyzePending(options = {}) {
  state.analyzing = true;
  const targetIds = options.soundIds ? new Set(options.soundIds) : null;
  const missingHashes = state.sounds.filter((sound) => !sound.contentHash && (!targetIds || targetIds.has(sound.id) || targetIds.has(sound.path)));
  const pending = state.sounds.filter((sound) => !sound.peaks?.length && (!targetIds || targetIds.has(sound.id) || targetIds.has(sound.path)));
  state.analysisDone = 0;
  state.analysisTotal = missingHashes.length + pending.length;
  let visibleCount = filteredSounds().length;
  if (options.showOverlay && state.analysisTotal) {
    showWorkOverlay(options.title || '正在建立素材库缓存', options.message || '正在生成波形和识别筛选');
    setWorkProgress(0, state.analysisTotal, '准备分析');
  }
  updateStats(visibleCount);
  let changed = false;
  try {
    for (const sound of missingHashes) {
      if (options.showOverlay) {
        setWorkProgress(state.analysisDone, state.analysisTotal, `正在识别重复 ${displayName(sound.name)}`);
      }
      try {
        sound.contentHash = await window.soundLibrary.fileHash(sound.path);
        changed = true;
      } catch {}
      state.analysisDone += 1;
    }
    for (const [index, sound] of pending.entries()) {
      if (options.showOverlay) {
        setWorkProgress(missingHashes.length + index, state.analysisTotal, `正在处理 ${displayName(sound.name)}`);
      }
      try {
        await analyzeSound(sound);
        changed = true;
      } catch {
        sound.analysis = { shape: '未知', frequency: '未知', dynamics: '未知', pitch: '未知' };
        changed = true;
      }
      state.analysisDone += 1;
      if (options.showOverlay) {
        setWorkProgress(state.analysisDone, state.analysisTotal, `已完成 ${state.analysisDone} / ${state.analysisTotal}`);
      }
      if (index % 20 === 0 || index === pending.length - 1) {
        state.filterCacheKey = '';
        visibleCount = filteredSounds().length;
        updateStats(visibleCount);
      }
    }
  } finally {
    state.analyzing = false;
    state.analysisDone = 0;
    state.analysisTotal = 0;
    if (options.showOverlay) hideWorkOverlay();
  }
  if (changed) {
    rebuildIndexes();
    if (state.selectedFolder === 'missing' && !state.missingCount) state.selectedFolder = 'all';
    saveState();
    renderAll(true);
  }
  refreshCacheInfo();
}

async function analyzeSound(sound) {
  if (!sound.contentHash) {
    sound.contentHash = await window.soundLibrary.fileHash(sound.path);
  }
  const cacheKey = `${sound.path}:${sound.modifiedAt}:${sound.size}`;
  const cached = await window.soundLibrary.loadWaveCache(cacheKey);
  if (cached?.peaks?.length) {
    sound.duration = cached.duration;
    sound.peaks = cached.peaks;
    sound.analysis = cached.analysis || sound.analysis;
    return;
  }
  const arrayBuffer = await window.soundLibrary.readAudioFile(sound.path);
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
  const channel = buffer.getChannelData(0);
  sound.duration = buffer.duration;
  sound.peaks = buildPeaks(channel, 520);
  sound.analysis = analyzeBuffer(channel, buffer.sampleRate, buffer.duration);
  await window.soundLibrary.saveWaveCache(cacheKey, {
    duration: sound.duration,
    peaks: sound.peaks,
    analysis: sound.analysis
  });
  await context.close();
}

function buildPeaks(channel, buckets) {
  const blockSize = Math.max(1, Math.floor(channel.length / buckets));
  const peaks = [];
  for (let i = 0; i < buckets; i += 1) {
    let min = 0;
    let max = 0;
    let sum = 0;
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    for (let j = start; j < end; j += 1) {
      const value = channel[j];
      if (value > max) max = value;
      if (value < min) min = value;
      sum += value * value;
    }
    peaks.push([min, max, Math.sqrt(sum / Math.max(1, end - start))]);
  }
  return peaks;
}

function analyzeBuffer(channel, sampleRate, duration) {
  const rmsBuckets = [];
  const bucketCount = 24;
  const blockSize = Math.max(1, Math.floor(channel.length / bucketCount));
  for (let i = 0; i < bucketCount; i += 1) {
    let sum = 0;
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    for (let j = start; j < end; j += 1) sum += channel[j] * channel[j];
    rmsBuckets.push(Math.sqrt(sum / Math.max(1, end - start)));
  }

  const first = average(rmsBuckets.slice(0, 6));
  const mid = average(rmsBuckets.slice(9, 15));
  const last = average(rmsBuckets.slice(-6));
  const startSpike = Math.max(...rmsBuckets.slice(0, 3));
  const endSpike = Math.max(...rmsBuckets.slice(-3));
  const zeroCrossing = countZeroCrossings(channel, Math.min(channel.length, sampleRate * 8)) / Math.min(channel.length, sampleRate * 8);

  let dynamics = '平稳';
  if (startSpike > mid * 1.8 && startSpike > 0.04) dynamics = '突强';
  else if (endSpike > mid * 1.8 && endSpike > 0.04) dynamics = '突弱';
  else if (last > first * 1.45) dynamics = '渐强';
  else if (first > last * 1.45) dynamics = '渐弱';

  let frequency = '中频';
  if (zeroCrossing < 0.045) frequency = '低频';
  if (zeroCrossing > 0.13) frequency = '高频';

  return {
    shape: duration >= 3.5 ? '长音' : '短音',
    frequency,
    dynamics,
    pitch: estimatePitchTrend(channel, sampleRate)
  };
}

function countZeroCrossings(channel, limit) {
  let count = 0;
  let previous = channel[0] >= 0;
  for (let i = 1; i < limit; i += 1) {
    const current = channel[i] >= 0;
    if (current !== previous) count += 1;
    previous = current;
  }
  return count;
}

function estimatePitchTrend(channel, sampleRate) {
  const windowSize = Math.min(sampleRate, Math.floor(channel.length / 4));
  if (windowSize < 1024) return '平稳';
  const start = dominantCrossingRate(channel, 0, windowSize);
  const end = dominantCrossingRate(channel, Math.max(0, channel.length - windowSize), windowSize);
  if (end > start * 1.22) return '升调';
  if (start > end * 1.22) return '降调';
  return '平稳';
}

function dominantCrossingRate(channel, start, length) {
  return countZeroCrossings(channel.slice(start, start + length), length) / length;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function renderAll(forceLibrary = false) {
  renderFilters();
  renderFolderTree();
  renderTagFilters();
  renderLibrary(forceLibrary);
  renderInspector();
  updateViewButtons();
  updateColumnButtons();
  els.sortSelect.value = state.sortMode;
  refreshCacheInfo();
}

function renderFilters() {
  els.filters.innerHTML = FILTERS.map(([key, label, options]) => `
    <div class="filter-group ${state.openFilter === key ? 'open' : ''}">
      <button class="filter-button" data-filter-toggle="${key}">
        <span>${label}</span>
        <strong>${state.filters[key] || '全部'} ▾</strong>
      </button>
      <div class="filter-menu">
        <button class="filter-option ${!state.filters[key] ? 'active' : ''}" data-filter="${key}" data-value="">全部</button>
        ${options.map((option) => `
          <button class="filter-option ${state.filters[key] === option ? 'active' : ''}" data-filter="${key}" data-value="${option}">${option}</button>
        `).join('')}
      </div>
    </div>
  `).join('');

  els.filters.querySelectorAll('[data-filter-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const key = button.dataset.filterToggle;
      state.openFilter = state.openFilter === key ? null : key;
      renderFilters();
    });
  });

  els.filters.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const key = button.dataset.filter;
      const value = button.dataset.value;
      if (value) state.filters[key] = value;
      else delete state.filters[key];
      state.openFilter = null;
      renderAll(true);
    });
  });
}

function renderFolderTree() {
  els.folderTree.className = 'folder-tree';
  const items = folderTreeItems();
  els.folderTree.innerHTML = items.map((item) => `
    <div class="tree-item tree-depth-${Math.min(item.depth, 4)} ${state.selectedFolder === item.id ? 'active' : ''} ${state.selectedFolderIds.has(item.id) ? 'multi-selected' : ''}" data-folder="${item.id}">
      <span>${folderIcon(item)}</span>
      <span>${escapeHtml(item.name)}</span>
      <span class="tree-count">${item.count}</span>
    </div>
  `).join('') + '<div id="folderMarquee" class="folder-marquee"></div>';
  els.folderMarquee = document.querySelector('#folderMarquee');

  els.folderTree.oncontextmenu = (event) => {
    event.preventDefault();
    const item = event.target.closest('[data-folder]');
    state.activeFolderId = item?.dataset.folder || 'all';
    if (item && !state.selectedFolderIds.has(item.dataset.folder)) {
      state.selectedFolderIds = new Set([item.dataset.folder]);
      renderFolderTree();
    }
    showFolderContextMenu(event.clientX, event.clientY);
  };
  els.folderTree.querySelectorAll('[data-folder]').forEach((item) => {
    item.addEventListener('click', (event) => handleFolderClick(event, item.dataset.folder));
  });
  bindFolderMarquee();
}

function handleFolderClick(event, folderId) {
  const visibleIds = folderTreeItems().map((item) => item.id);
  if (event.shiftKey && state.lastFolderClickId) {
    const start = visibleIds.indexOf(state.lastFolderClickId);
    const end = visibleIds.indexOf(folderId);
    if (start !== -1 && end !== -1) {
      const [from, to] = start < end ? [start, end] : [end, start];
      state.selectedFolderIds = new Set(visibleIds.slice(from, to + 1).filter((id) => id !== 'all'));
    }
  } else if (event.metaKey || event.ctrlKey) {
    if (!isSystemFolder(folderId)) {
      if (state.selectedFolderIds.has(folderId)) state.selectedFolderIds.delete(folderId);
      else state.selectedFolderIds.add(folderId);
    }
  } else {
    state.selectedFolderIds = isSystemFolder(folderId) ? new Set() : new Set([folderId]);
  }
  state.lastFolderClickId = folderId;
  state.selectedFolder = folderId;
  state.activeFolderId = folderId;
  saveState();
  renderAll(true);
}

function bindFolderMarquee() {
  els.folderTree.onmousedown = (event) => {
    if (event.button !== 0 || event.target.closest('[data-folder]')) return;
    const rect = els.folderTree.getBoundingClientRect();
    state.folderDragSelect = {
      startX: event.clientX,
      startY: event.clientY,
      rect
    };
    state.selectedFolderIds = new Set();
    showFolderMarquee(event.clientX, event.clientY, event.clientX, event.clientY);
    event.preventDefault();
  };
  window.onmousemove = (event) => {
    if (!state.folderDragSelect) return;
    showFolderMarquee(state.folderDragSelect.startX, state.folderDragSelect.startY, event.clientX, event.clientY);
    updateMarqueeSelection();
  };
  window.onmouseup = () => {
    if (!state.folderDragSelect) return;
    state.folderDragSelect = null;
    els.folderMarquee?.classList.remove('show');
    renderFolderTree();
  };
}

function showFolderMarquee(x1, y1, x2, y2) {
  if (!els.folderMarquee) return;
  const rect = els.folderTree.getBoundingClientRect();
  const left = Math.min(x1, x2) - rect.left + els.folderTree.scrollLeft;
  const top = Math.min(y1, y2) - rect.top + els.folderTree.scrollTop;
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  Object.assign(els.folderMarquee.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  });
  els.folderMarquee.classList.add('show');
}

function updateMarqueeSelection() {
  const marquee = els.folderMarquee.getBoundingClientRect();
  state.selectedFolderIds = new Set();
  els.folderTree.querySelectorAll('[data-folder]').forEach((item) => {
    if (isSystemFolder(item.dataset.folder)) return;
    const rect = item.getBoundingClientRect();
    const intersects = rect.left < marquee.right && rect.right > marquee.left && rect.top < marquee.bottom && rect.bottom > marquee.top;
    item.classList.toggle('multi-selected', intersects);
    if (intersects) state.selectedFolderIds.add(item.dataset.folder);
  });
}

function folderTreeItems() {
  const items = [
    { id: 'all', name: '全部素材', depth: 0, count: state.sounds.length, system: true },
    { id: 'favorites', name: '收藏夹', depth: 0, count: state.favoriteCount, system: true }
  ];
  if (state.missingCount) items.push({ id: 'missing', name: '缺失文件', depth: 0, count: state.missingCount, system: true });
  appendVirtualFolders(items, 'all');
  return items;
}

function folderIcon(item) {
  if (item.id === 'favorites') return '★';
  if (item.id === 'missing') return '!';
  if (item.system) return '◇';
  return item.virtual ? '□' : '⌞';
}

function isSystemFolder(folderId) {
  return ['all', 'favorites', 'missing'].includes(folderId);
}

function appendVirtualFolders(items, parentId) {
  (state.folderChildrenByParent.get(parentId) || [])
    .filter((folder) => folder.id !== 'all')
    .forEach((folder) => {
      items.push({
        ...folder,
        depth: folderDepth(folder.id),
        count: state.folderCountById.get(folder.id) || 0,
        virtual: true
      });
      appendVirtualFolders(items, folder.id);
    });
}

function countFolderSounds(folderId) {
  return state.folderCountById.get(folderId) || 0;
}

function folderDepth(folderId) {
  let depth = 1;
  let folder = state.folderById.get(folderId);
  while (folder?.parentId && folder.parentId !== 'all') {
    depth += 1;
    folder = state.folderById.get(folder.parentId);
  }
  return depth;
}

function renderTagFilters() {
  const tags = [...new Set(state.sounds.flatMap((sound) => sound.tags || []))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (!tags.length) {
    els.tagFilters.innerHTML = '<span class="tag-filter-empty">添加自定义标签后，会出现在这里用于快速筛选</span>';
    return;
  }
  els.tagFilters.innerHTML = `
    <button class="tag-filter ${!state.tagFilter ? 'active' : ''}" data-tag-filter="">全部标签</button>
    ${tags.map((tag) => `<button class="tag-filter ${state.tagFilter === tag ? 'active' : ''}" data-tag-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}
  `;
  els.tagFilters.querySelectorAll('[data-tag-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.tagFilter = button.dataset.tagFilter;
      renderAll(true);
    });
  });
}

function renderLibrary(force = false) {
  const sounds = sortedSounds(filteredSounds());
  if (force) state.renderLimit = initialRenderLimit();
  const visibleSounds = sounds.slice(0, state.renderLimit);
  const renderKey = JSON.stringify({
    ids: visibleSounds.map((sound) => `${sound.id}:${sound.duration}:${sound.peaks?.length || 0}:${sound.tags?.join(',')}:${sound.favorite}:${sound.missing}`),
    total: sounds.length,
    limit: state.renderLimit,
    view: state.viewMode,
    columns: state.cardColumns,
    sort: state.sortMode,
    selectedFolder: state.selectedFolder,
    query: state.query,
    filters: state.filters,
    tag: state.tagFilter
  });
  const previousScrollTop = els.soundList.scrollTop;
  updateStats(sounds.length);
  if (!force && renderKey === state.lastRenderedKey) {
    updateSelectionClasses();
    repaintWaves();
    return;
  }
  state.lastRenderedKey = renderKey;
  els.soundList.className = `sound-list ${state.viewMode === 'card' ? 'card-grid' : 'list-grid'} columns-${state.cardColumns}`;

  if (!sounds.length) {
    els.soundList.innerHTML = `<div class="empty-state">没有符合条件的音效<br>可以导入文件夹，或者清空筛选后查看</div>`;
    return;
  }

  const more = sounds.length > visibleSounds.length
    ? `<button class="load-more" data-load-more>继续显示 ${Math.min(renderBatchSize(), sounds.length - visibleSounds.length)} 个 / 剩余 ${sounds.length - visibleSounds.length}</button>`
    : '';
  els.soundList.innerHTML = visibleSounds.map((sound) => state.viewMode === 'card' ? soundCardTemplate(sound) : soundRowTemplate(sound)).join('') + more;
  bindSoundItems();
  if (!force) els.soundList.scrollTop = previousScrollTop;
  requestAnimationFrame(repaintVisibleWaves);
}

function initialRenderLimit() {
  return state.viewMode === 'card' ? 120 : 180;
}

function renderBatchSize() {
  return state.viewMode === 'card' ? 80 : 140;
}

function maybeExtendRenderedSounds() {
  if (!els.soundList || els.soundList.scrollHeight - els.soundList.scrollTop - els.soundList.clientHeight > 720) return;
  const total = filteredSounds().length;
  if (state.renderLimit >= total) return;
  state.renderLimit = Math.min(total, state.renderLimit + renderBatchSize());
  renderLibrary(false);
}

function sortedSounds(sounds) {
  const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
  return [...sounds].sort((a, b) => {
    if (state.sortMode === 'name-asc') return collator.compare(displayName(a.name), displayName(b.name));
    if (state.sortMode === 'name-desc') return collator.compare(displayName(b.name), displayName(a.name));
    if (state.sortMode === 'duration-asc') return (a.duration || 0) - (b.duration || 0);
    if (state.sortMode === 'duration-desc') return (b.duration || 0) - (a.duration || 0);
    if (state.sortMode === 'type-asc') return collator.compare(a.extension || '', b.extension || '') || collator.compare(displayName(a.name), displayName(b.name));
    return (b.addedAt || b.modifiedAt || 0) - (a.addedAt || a.modifiedAt || 0);
  });
}

function updateStats(count) {
  els.statCount.textContent = state.analyzing && state.analysisTotal
    ? `${count} 个音效 · 分析中 ${state.analysisDone}/${state.analysisTotal}`
    : `${count} 个音效`;
}

function soundCardTemplate(sound) {
  return `
    <article class="sound-card ${sound.id === state.previewId ? 'selected' : ''} ${sound.missing ? 'missing' : ''}" data-id="${sound.id}" ${dragAttribute(sound)}>
      <div class="card-topline">
        <span>${formatTime(sound.duration || 0)}</span>
        <span class="card-tools">
          ${sound.missing ? '<em>缺失</em>' : ''}
          <button class="favorite-button ${sound.favorite ? 'active' : ''}" data-toggle-favorite="${sound.id}" title="${sound.favorite ? '取消收藏' : '加入收藏'}">★</button>
          <span>${escapeHtml(sound.extension?.replace('.', '').toUpperCase() || '')}</span>
        </span>
      </div>
      <canvas class="wave-item wave-card" width="620" height="168" data-wave="${sound.id}"></canvas>
      <div class="sound-name">
        <strong>${escapeHtml(displayName(sound.name))}</strong>
        <span>${escapeHtml(sound.relativePath)}</span>
      </div>
      <div class="auto-tags">${compactTags(sound).map((tag) => `<span class="analysis-pill">${tag}</span>`).join('')}</div>
    </article>
  `;
}

function soundRowTemplate(sound) {
  return `
    <article class="sound-row ${sound.id === state.previewId ? 'selected' : ''} ${sound.missing ? 'missing' : ''}" data-id="${sound.id}" ${dragAttribute(sound)}>
      <div class="sound-name">
        <strong><button class="favorite-button ${sound.favorite ? 'active' : ''}" data-toggle-favorite="${sound.id}" title="${sound.favorite ? '取消收藏' : '加入收藏'}">★</button>${escapeHtml(displayName(sound.name))}</strong>
        <span>${escapeHtml(sound.relativePath)}</span>
      </div>
      <canvas class="wave-item wave-mini" width="560" height="82" data-wave="${sound.id}"></canvas>
      <span class="duration-pill">${formatTime(sound.duration || 0)}</span>
      <div class="auto-tags">${compactTags(sound).map((tag) => `<span class="analysis-pill">${tag}</span>`).join('')}</div>
    </article>
  `;
}

function dragAttribute(sound) {
  return sound?.missing ? 'draggable="false"' : 'draggable="true"';
}

function bindSoundItems() {
  els.soundList.querySelector('[data-load-more]')?.addEventListener('click', () => {
    const total = filteredSounds().length;
    state.renderLimit = Math.min(total, state.renderLimit + renderBatchSize());
    renderLibrary(false);
  });
  els.soundList.querySelectorAll('[data-id]').forEach((item) => {
    item.addEventListener('mouseenter', () => {
      setPreviewSound(item.dataset.id, false);
    });
    item.addEventListener('click', () => setPreviewSound(item.dataset.id, false));
    item.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      state.activeContextId = item.dataset.id;
      showContextMenu(event.clientX, event.clientY);
    });
    item.addEventListener('dragstart', (event) => {
      const sound = state.soundById.get(item.dataset.id);
      if (!sound) return;
      if (sound.missing) {
        event.preventDefault();
        toast('原文件缺失，不能拖出');
        return;
      }
      if (state.platform === 'win32' && isSharedWindowsPath(sound.path)) {
        toast('建议先把音频放到 Windows 本地磁盘再拖入剪辑软件');
      }
      const fileUrl = fileUrlForDrag(sound.path);
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', sound.path);
      event.dataTransfer.setData('text/uri-list', fileUrl);
      event.dataTransfer.setData('DownloadURL', `audio/${(sound.extension || '.wav').slice(1)}:${sound.name}:${fileUrl}`);
      event.preventDefault();
      clearDraggingState();
      item.classList.add('dragging');
      window.soundLibrary.startDrag(sound.path);
      setTimeout(clearDraggingState, 1600);
    });
    item.addEventListener('dragend', clearDraggingState);
  });

  els.soundList.querySelectorAll('[data-toggle-favorite]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(button.dataset.toggleFavorite);
    });
  });

  els.soundList.querySelectorAll('[data-wave]').forEach((canvas) => {
    bindWaveScrub(canvas, () => state.soundById.get(canvas.dataset.wave), false);
  });
}

function clearDraggingState() {
  els.soundList?.querySelectorAll('.dragging').forEach((item) => item.classList.remove('dragging'));
}

function fileUrlForDrag(filePath) {
  if (state.platform === 'win32') {
    return `file:///${String(filePath).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}`;
  }
  return `file://${String(filePath).split('/').map(encodeURIComponent).join('/')}`;
}

function isSharedWindowsPath(filePath) {
  const value = String(filePath || '');
  return /^z:/i.test(value) || /^\\\\/.test(value) || /DavWWWRoot/i.test(value);
}

function renderInspector() {
  const selected = getPreviewSound();
  els.previewTitle.textContent = selected ? displayName(selected.name) : '选择一个音效';
  els.emptyWave.style.display = selected?.peaks?.length ? 'none' : 'grid';
  els.revealBtn.disabled = !selected;
  els.tagInput.disabled = !selected;
  els.metaPath.textContent = selected?.path || '-';
  els.metaFolder.textContent = selected?.relativePath || '-';
  els.metaFormat.textContent = selected?.extension?.replace('.', '').toUpperCase() || '-';
  els.metaStatus.textContent = selected ? soundStatusText(selected) : '-';
  els.durationTime.textContent = formatPrecise(selected?.duration || 0);
  renderTransport();
  renderTags(selected);
  renderAnalysis(selected);
  drawLargeWave(selected);
  updateSelectionClasses();
}

function openDuplicateDialog(focusHashes = []) {
  const focus = new Set(focusHashes);
  state.duplicateGroups = duplicateGroups().sort((a, b) => {
    if (focus.has(a.hash) && !focus.has(b.hash)) return -1;
    if (!focus.has(a.hash) && focus.has(b.hash)) return 1;
    return displayName(a.items[0].name).localeCompare(displayName(b.items[0].name), 'zh-CN');
  });
  state.duplicateActiveHash = state.duplicateGroups[0]?.hash || '';
  state.duplicateDialogOpen = true;
  els.duplicateDialog.classList.add('show');
  renderDuplicateDialog();
}

async function scanDuplicates(options = {}) {
  if (options.manual) {
    await withLibraryWork('正在识别相同音频', '正在按真实文件内容比对素材库索引', async () => {
      await ensureMissingContentHashes();
    });
  }
  const groups = duplicateGroups();
  if (!groups.length) {
    closeDuplicateDialog();
    return toast('没有发现相同音频');
  }
  openDuplicateDialog();
  if (options.manual) toast(`发现 ${groups.length} 组相同音频`);
}

async function ensureMissingContentHashes() {
  const missing = state.sounds.filter((sound) => !sound.contentHash);
  if (!missing.length) {
    setWorkProgress(1, 1, '识别完成');
    return;
  }
  let changed = false;
  for (const [index, sound] of missing.entries()) {
    setWorkProgress(index, missing.length, `正在识别 ${displayName(sound.name)}`);
    try {
      sound.contentHash = await window.soundLibrary.fileHash(sound.path);
      changed = true;
    } catch {}
  }
  setWorkProgress(missing.length, missing.length, '识别完成');
  if (changed) saveState();
}

function renderDuplicateDialog() {
  const groups = state.duplicateGroups;
  els.duplicateDialogTitle.textContent = groups.length ? `相同音频识别 · ${groups.length} 组` : '相同音频识别';
  els.duplicateGroupList.innerHTML = groups.length
    ? groups.map((group, index) => duplicateGroupTabTemplate(group, index)).join('')
    : '<div class="duplicate-empty">没有发现相同音频</div>';

  const group = activeDuplicateGroup();
  els.duplicatePreviewEmpty.style.display = group ? 'none' : 'grid';
  els.duplicatePreviewContent.style.display = group ? 'grid' : 'none';
  if (!group) return;

  els.duplicateGroupCount.textContent = `${group.items.length} 个相同音频`;
  els.duplicateGroupName.textContent = displayName(group.items[0].name);
  els.duplicateCandidates.innerHTML = group.items.map((sound) => duplicateItemTemplate(sound, group.keepId)).join('');

  els.duplicateGroupList.querySelectorAll('[data-duplicate-hash]').forEach((button) => {
    button.addEventListener('click', () => {
      stopDuplicatePreview();
      state.duplicateActiveHash = button.dataset.duplicateHash;
      renderDuplicateDialog();
    });
  });
  els.duplicateCandidates.querySelectorAll('[data-keep-duplicate]').forEach((button) => {
    button.addEventListener('click', () => resolveDuplicateGroup(button.dataset.duplicateHash, button.dataset.keepDuplicate));
  });
  els.duplicateCandidates.querySelectorAll('[data-reveal-duplicate]').forEach((button) => {
    button.addEventListener('click', () => {
      const sound = state.sounds.find((item) => item.id === button.dataset.revealDuplicate);
      if (sound) window.soundLibrary.revealFile(sound.path);
    });
  });
  els.duplicateCandidates.querySelectorAll('[data-play-duplicate]').forEach((button) => {
    button.addEventListener('click', () => toggleDuplicatePreview(button.dataset.playDuplicate));
  });
  requestAnimationFrame(drawDuplicateWaves);
}

function duplicateGroupTabTemplate(group, index) {
  return `
    <button class="duplicate-group-tab ${group.hash === state.duplicateActiveHash ? 'active' : ''}" data-duplicate-hash="${group.hash}">
      <span>第 ${index + 1} 组</span>
      <strong>${escapeHtml(displayName(group.items[0].name))}</strong>
      <em>${group.items.length} 个</em>
    </button>
  `;
}

function duplicateItemTemplate(sound, keepId) {
  const isKeep = sound.id === keepId;
  return `
    <article class="duplicate-item ${isKeep ? 'recommended' : ''}" data-duplicate-sound="${sound.id}">
      <div class="duplicate-main">
        <strong>${escapeHtml(displayName(sound.name))}</strong>
        <span>${escapeHtml(folderPathLabel(sound.libraryFolderId))}</span>
        <em>${escapeHtml(sound.path)}</em>
      </div>
      <canvas class="duplicate-wave" width="760" height="96" data-duplicate-wave="${sound.id}"></canvas>
      <div class="duplicate-meta">
        <span>${escapeHtml(sound.extension?.replace('.', '').toUpperCase() || '-')}</span>
        <span>${formatBytes(sound.size || 0)}</span>
        <span>${formatDate(sound.addedAt || sound.modifiedAt)}</span>
      </div>
      <div class="duplicate-actions">
        <button class="mini-button" data-play-duplicate="${sound.id}">${state.duplicateAudio?.dataset.id === sound.id && !state.duplicateAudio.paused ? '暂停' : '预览'}</button>
        <button class="mini-button" data-reveal-duplicate="${sound.id}">显示</button>
        <button class="mini-button ${isKeep ? 'primary' : ''}" data-duplicate-hash="${sound.contentHash}" data-keep-duplicate="${sound.id}">
          ${isKeep ? '保留建议' : '保留这个'}
        </button>
      </div>
    </article>
  `;
}

function duplicateGroups() {
  const groups = new Map();
  state.sounds.forEach((sound) => {
    if (!sound.contentHash) return;
    if (!groups.has(sound.contentHash)) groups.set(sound.contentHash, []);
    groups.get(sound.contentHash).push(sound);
  });

  return [...groups.entries()]
    .map(([hash, items]) => ({
      hash,
      items: items.sort((a, b) => (a.addedAt || a.modifiedAt || 0) - (b.addedAt || b.modifiedAt || 0)),
      keepId: chooseDuplicateKeepId(items)
    }))
    .filter((group) => group.items.length > 1);
}

function chooseDuplicateKeepId(items) {
  const selected = items.find((sound) => sound.id === state.previewId || sound.id === state.selectedId);
  if (selected) return selected.id;
  const inCurrentFolder = !isSystemFolder(state.selectedFolder) && items.find((sound) => folderContainsSound(state.selectedFolder, sound));
  if (inCurrentFolder) return inCurrentFolder.id;
  return [...items].sort((a, b) => (a.addedAt || a.modifiedAt || 0) - (b.addedAt || b.modifiedAt || 0))[0]?.id;
}

function resolveDuplicateGroup(hash, keepId) {
  const group = state.sounds.filter((sound) => sound.contentHash === hash);
  if (group.length <= 1 || !group.some((sound) => sound.id === keepId)) return;
  const removeIds = new Set(group.filter((sound) => sound.id !== keepId).map((sound) => sound.id));
  state.sounds = state.sounds.filter((sound) => !removeIds.has(sound.id));
  rebuildIndexes();
  reconcileSoundSelection(removeIds, keepId);
  stopDuplicatePreview();
  saveState();
  renderAll(true);
  state.duplicateGroups = duplicateGroups();
  if (!state.duplicateGroups.some((item) => item.hash === state.duplicateActiveHash)) {
    state.duplicateActiveHash = state.duplicateGroups[0]?.hash || '';
  }
  if (!state.duplicateGroups.length) closeDuplicateDialog();
  else if (state.duplicateDialogOpen) renderDuplicateDialog();
  toast(`已保留 1 个，移除 ${removeIds.size} 个重复索引`);
}

function activeDuplicateGroup() {
  return state.duplicateGroups.find((group) => group.hash === state.duplicateActiveHash) || state.duplicateGroups[0] || null;
}

async function toggleDuplicatePreview(id) {
  const sound = state.soundById.get(id);
  if (!sound) return;
  if (state.duplicateAudio?.dataset.id === id && !state.duplicateAudio.paused) {
    state.duplicateAudio.pause();
    drawDuplicateWaves();
    return;
  }
  stopDuplicatePreview();
  const exists = await window.soundLibrary.fileExists(sound.path);
  if (!exists) return toast('找不到原文件，可能已被移动');
  state.duplicateAudio = new Audio(await window.soundLibrary.fileUrl(sound.path));
  state.duplicateAudio.dataset.id = id;
  state.duplicateAudio.addEventListener('ended', () => drawDuplicateWaves());
  await state.duplicateAudio.play();
  drawDuplicateWaves();
}

function stopDuplicatePreview() {
  if (state.duplicateAudio) {
    state.duplicateAudio.pause();
    state.duplicateAudio = null;
  }
}

function drawDuplicateWaves() {
  els.duplicateCandidates?.querySelectorAll('[data-duplicate-wave]').forEach((canvas) => {
    const sound = state.soundById.get(canvas.dataset.duplicateWave);
    drawWave(canvas, sound, {
      playhead: state.duplicateAudio?.dataset.id === sound?.id ? state.duplicateAudio.currentTime : null
    });
  });
}

function closeDuplicateDialog() {
  state.duplicateDialogOpen = false;
  state.duplicateGroups = [];
  state.duplicateActiveHash = '';
  stopDuplicatePreview();
  els.duplicateDialog.classList.remove('show');
}

function renderTags(selected) {
  if (!selected) {
    els.customTags.innerHTML = '';
    return;
  }
  const tags = selected.tags || [];
  els.customTags.innerHTML = tags.length
    ? tags.map((tag) => `<span class="tag">${escapeHtml(tag)}<button data-remove-tag="${escapeHtml(tag)}">×</button></span>`).join('')
    : '<span class="tag-hint">回车添加，标签会出现在上方筛选栏</span>';
  els.customTags.querySelectorAll('[data-remove-tag]').forEach((button) => {
    button.addEventListener('click', () => {
      selected.tags = selected.tags.filter((tag) => tag !== button.dataset.removeTag);
      if (state.tagFilter === button.dataset.removeTag) state.tagFilter = '';
      saveState();
      renderAll(true);
    });
  });
}

function renderAnalysis(selected) {
  if (!selected) {
    els.analysisGrid.innerHTML = '';
    return;
  }
  els.analysisGrid.innerHTML = FILTERS.map(([key, label]) => `
    <div class="analysis-item">
      <span>${label}</span>
      <strong>${selected.analysis?.[key] || '未识别'}</strong>
    </div>
  `).join('');
}

function renderTransport() {
  const target = getPreviewSound();
  const current = state.audio && target && state.audio.dataset.id === target.id
    ? state.audio.currentTime
    : state.playheadTime;
  els.currentTime.textContent = formatPrecise(current || 0);
  els.playBtn.textContent = state.isPlaying ? 'Ⅱ' : '▶';
  els.playBtn.classList.toggle('playing', state.isPlaying);
}

function setViewMode(mode) {
  state.viewMode = mode;
  saveState();
  renderLibrary(true);
  updateViewButtons();
}

function updateViewButtons() {
  els.cardViewBtn.classList.toggle('active', state.viewMode === 'card');
  els.listViewBtn.classList.toggle('active', state.viewMode === 'list');
  els.columnToggle.style.display = state.viewMode === 'card' ? 'inline-flex' : 'none';
}

function updateColumnButtons() {
  els.columnToggle.querySelectorAll('[data-columns]').forEach((button) => {
    button.classList.toggle('active', button.dataset.columns === state.cardColumns);
  });
}

function setPreviewSound(id, redrawLibrary = false) {
  if (!id || state.previewId === id) return;
  const previousId = state.previewId;
  state.previewId = id;
  state.selectedId = id;
  state.hoverTime = null;
  state.hoverSoundId = null;
  state.playheadTime = 0;
  if (redrawLibrary) saveState();
  if (redrawLibrary) renderLibrary(true);
  else {
    drawItemWave(previousId);
    drawItemWave(id);
  }
  renderInspector();
}

async function togglePlay() {
  const selected = getPreviewSound();
  if (!selected) return;
  const shouldSwitchSound = state.isPlaying && state.audio?.dataset.id !== selected.id;
  if (state.isPlaying && state.audio && !shouldSwitchSound) {
    state.audio.pause();
    state.playheadTime = state.audio.currentTime;
    state.isPlaying = false;
    renderTransport();
    repaintWaves();
    return;
  }
  const exists = await window.soundLibrary.fileExists(selected.path);
      if (!exists) {
        selected.missing = true;
        selected.missingCheckedAt = Date.now();
        rebuildIndexes();
        saveState();
        renderAll(true);
        return toast('找不到原文件，可能已被移动');
      }
      if (selected.missing) {
        selected.missing = false;
        selected.missingCheckedAt = Date.now();
        rebuildIndexes();
        saveState();
        renderAll(true);
      }
  if (shouldSwitchSound) stopPlayback();
  if (!state.audio || state.audio.dataset.id !== selected.id) {
    state.audio = new Audio(await window.soundLibrary.fileUrl(selected.path));
    state.audio.dataset.id = selected.id;
    state.audio.addEventListener('ended', () => {
      state.isPlaying = false;
      state.playheadTime = 0;
      renderTransport();
      repaintWaves();
    });
  }
  const startAt = state.hoverSoundId === selected.id && state.hoverTime != null ? state.hoverTime : state.playheadTime;
  state.audio.currentTime = Math.min(selected.duration || Number.MAX_SAFE_INTEGER, startAt || 0);
  state.playheadTime = state.audio.currentTime;
  await state.audio.play();
  state.isPlaying = true;
  renderTransport();
}

function stopPlayback() {
  const previousId = state.audio?.dataset.id;
  if (state.audio) {
    state.audio.pause();
    state.audio = null;
  }
  state.isPlaying = false;
  if (previousId) drawItemWave(previousId);
}

function filteredSounds() {
  const cacheKey = JSON.stringify({
    indexVersion: state.indexVersion,
    selectedFolder: state.selectedFolder,
    tagFilter: state.tagFilter,
    query: state.query,
    filters: state.filters
  });
  if (state.filterCacheKey === cacheKey) return state.filterCacheResult;
  const folderSet = folderMatchSet(state.selectedFolder);
  const result = state.sounds.filter((sound) => {
    if (state.selectedFolder === 'favorites' && !sound.favorite) return false;
    if (state.selectedFolder === 'missing' && !sound.missing) return false;
    if (folderSet && !folderSet.has(sound.libraryFolderId)) {
      return false;
    }
    if (state.tagFilter && !(sound.tags || []).includes(state.tagFilter)) return false;
    if (state.query) {
      const haystack = `${sound.name} ${sound.relativePath} ${(sound.tags || []).join(' ')}`.toLowerCase();
      if (!haystack.includes(state.query)) return false;
    }
    for (const [key, value] of Object.entries(state.filters)) {
      if (sound.analysis?.[key] !== value) return false;
    }
    return true;
  });
  state.filterCacheKey = cacheKey;
  state.filterCacheResult = result;
  return result;
}

function getSelectedSound() {
  return state.soundById.get(state.selectedId) || null;
}

function getPreviewSound() {
  return state.soundById.get(state.previewId) || getSelectedSound();
}

function folderContainsSound(folderId, sound) {
  if (folderId === 'favorites') return Boolean(sound.favorite);
  if (folderId === 'missing') return Boolean(sound.missing);
  return folderMatchSet(folderId)?.has(sound.libraryFolderId) || false;
}

function folderMatchSet(folderId) {
  if (isSystemFolder(folderId)) return null;
  if (!state.folderById.has(folderId)) return new Set();
  return new Set([folderId, ...(state.folderDescendantsById.get(folderId) || [])]);
}

function removeSound(id) {
  const index = state.sounds.findIndex((sound) => sound.id === id);
  if (index === -1) return;
  state.sounds.splice(index, 1);
  rebuildIndexes();
  reconcileSoundSelection(new Set([id]));
  saveState();
  renderAll(true);
}

function toggleFavorite(id) {
  const sound = state.soundById.get(id);
  if (!sound) return;
  sound.favorite = !sound.favorite;
  rebuildIndexes();
  saveState();
  renderAll(true);
  toast(sound.favorite ? '已加入收藏夹' : '已取消收藏');
}

function soundStatusText(sound) {
  if (sound.missing) return sound.favorite ? '收藏 / 原文件缺失' : '原文件缺失';
  return sound.favorite ? '收藏' : '正常';
}

async function checkMissingFiles(options = {}) {
  if (state.checkingMissing || !state.sounds.length) return;
  state.checkingMissing = true;
  const showOverlay = !options.silent;
  const soundsToCheck = options.limit ? state.sounds.slice(0, options.limit) : state.sounds;
  let changed = false;
  let missingCount = 0;
  try {
    if (showOverlay) {
      showWorkOverlay('正在检查缺失文件', '正在确认原始音频路径是否仍然可用');
      setWorkProgress(0, soundsToCheck.length, '准备检查');
    }
    for (const [index, sound] of soundsToCheck.entries()) {
      if (showOverlay) setWorkProgress(index, soundsToCheck.length, `正在检查 ${displayName(sound.name)}`);
      let exists = false;
      try {
        exists = await window.soundLibrary.fileExists(sound.path);
      } catch {
        exists = false;
      }
      const nextMissing = !exists;
      if (sound.missing !== nextMissing) {
        sound.missing = nextMissing;
        changed = true;
      }
      sound.missingCheckedAt = Date.now();
      if (sound.missing) missingCount += 1;
    }
    if (showOverlay) setWorkProgress(soundsToCheck.length, soundsToCheck.length, '检查完成');
  } finally {
    state.checkingMissing = false;
    if (showOverlay) hideWorkOverlay();
  }
  if (changed) {
    rebuildIndexes();
    saveState();
    renderAll(true);
  } else if (!options.silent) {
    renderFolderTree();
    renderInspector();
  }
  if (!options.silent) toast(missingCount ? `发现 ${missingCount} 个缺失文件` : '没有发现缺失文件');
}

function reconcileSoundSelection(removedIds, preferredId = null) {
  const removed = removedIds instanceof Set ? removedIds : new Set(removedIds);
  if (state.audio?.dataset.id && removed.has(state.audio.dataset.id)) stopPlayback();
  const preferredExists = preferredId && state.sounds.some((sound) => sound.id === preferredId);
  const fallbackId = preferredExists ? preferredId : state.sounds[0]?.id || null;
  if (!state.sounds.some((sound) => sound.id === state.selectedId)) state.selectedId = fallbackId;
  if (!state.sounds.some((sound) => sound.id === state.previewId)) state.previewId = state.selectedId;
}

function folderPathLabel(folderId) {
  if (!folderId || folderId === 'all') return '全部素材';
  const parts = [];
  let folder = state.folders.find((item) => item.id === folderId);
  while (folder) {
    parts.unshift(folder.name);
    if (!folder.parentId || folder.parentId === 'all') break;
    folder = state.folders.find((item) => item.id === folder.parentId);
  }
  return ['全部素材', ...parts].join(' / ');
}

function compactTags(sound) {
  const parts = [sound.missing ? '缺失' : '', sound.favorite ? '收藏' : '', sound.analysis?.shape, sound.analysis?.frequency, sound.analysis?.dynamics, sound.analysis?.pitch]
    .filter((value) => value && value !== '识别中' && value !== '未知');
  return parts.length ? parts : ['分析中'];
}

function displayName(name) {
  return String(name || '').replace(/\.[^.]+$/, '');
}

function drawLargeWave(sound) {
  drawWave(els.largeWave, sound, {
    large: true,
    playhead: wavePlayheadFor(sound),
    hoverhead: state.hoverSoundId === sound?.id ? state.hoverTime : null
  });
}

function drawItemWave(soundId) {
  const canvas = els.soundList.querySelector(`[data-wave="${cssEscape(soundId)}"]`);
  const sound = state.soundById.get(soundId);
  if (canvas && sound) {
    drawWave(canvas, sound, {
      playhead: wavePlayheadFor(sound),
      hoverhead: state.hoverSoundId === sound.id ? state.hoverTime : null
    });
  }
}

function repaintWaves() {
  repaintVisibleWaves();
  drawLargeWave(getPreviewSound());
}

function repaintVisibleWaves() {
  els.soundList.querySelectorAll('[data-wave]').forEach((canvas) => {
    const sound = state.soundById.get(canvas.dataset.wave);
    drawWave(canvas, sound, {
      playhead: wavePlayheadFor(sound),
      hoverhead: state.hoverSoundId === sound?.id ? state.hoverTime : null
    });
  });
}

function wavePlayheadFor(sound) {
  if (!sound) return 0;
  if (state.audio?.dataset.id === sound.id) return state.audio.currentTime;
  return null;
}

function drawWave(canvas, sound, options = {}) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (!sound?.peaks?.length) return;

  const styles = getComputedStyle(document.body);
  const line = styles.getPropertyValue('--line').trim();
  const isLight = document.body.classList.contains('light');
  const headColor = isLight ? 'rgba(37, 99, 235, .98)' : 'rgba(92, 210, 255, .98)';
  const hoverColor = isLight ? 'rgba(17, 24, 39, .62)' : 'rgba(255,255,255,.72)';
  const midY = height / 2;
  const padX = options.large ? 20 : 14;
  const padY = options.large ? 18 : 12;
  const usableWidth = width - padX * 2;
  const step = usableWidth / sound.peaks.length;
  const now = performance.now();
  const intro = Math.min(1, (now - state.waveStartedAt) / 520);
  const active = state.audio?.dataset.id === sound.id || state.hoverSoundId === sound.id;
  const pulse = active ? 0.5 + Math.sin(now / 360) * 0.5 : 0;
  const envelopeAlpha = (options.large ? 0.32 : 0.22) * intro + pulse * 0.08;

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = line;
  for (let x = padX; x < width - padX; x += options.large ? 48 : 38) {
    ctx.fillRect(x, padY, 1, height - padY * 2);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, midY);
  ctx.lineTo(width - padX, midY);
  ctx.stroke();
  ctx.restore();

  const envelopeTop = [];
  const envelopeBottom = [];
  const smoothWindow = options.large ? 7 : 5;
  for (let index = 0; index < sound.peaks.length; index += 1) {
    let energy = 0;
    let count = 0;
    for (let offset = -smoothWindow; offset <= smoothWindow; offset += 1) {
      const peak = sound.peaks[index + offset];
      if (!peak) continue;
      energy += Math.max(Math.abs(peak[0]), Math.abs(peak[1]), peak[2] || 0);
      count += 1;
    }
    energy = count ? energy / count : 0;
    const x = padX + index * step;
    const amp = Math.max(2, energy * midY * (options.large ? 0.9 : 0.75));
    envelopeTop.push([x, midY - amp]);
    envelopeBottom.push([x, midY + amp]);
  }

  const envelopeFill = ctx.createLinearGradient(0, padY, 0, height - padY);
  envelopeFill.addColorStop(0, isLight ? `rgba(96, 165, 250, ${envelopeAlpha})` : `rgba(110, 231, 189, ${envelopeAlpha})`);
  envelopeFill.addColorStop(0.5, isLight ? `rgba(79, 70, 229, ${envelopeAlpha * 0.35})` : `rgba(123, 183, 255, ${envelopeAlpha * 0.35})`);
  envelopeFill.addColorStop(1, isLight ? `rgba(37, 99, 235, ${envelopeAlpha})` : `rgba(110, 231, 189, ${envelopeAlpha})`);

  ctx.save();
  ctx.fillStyle = envelopeFill;
  ctx.beginPath();
  envelopeTop.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  [...envelopeBottom].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const playedRatio = sound.duration && options.playhead ? Math.min(1, Math.max(0, options.playhead / sound.duration)) : 0;
  const playedX = padX + playedRatio * usableWidth;

  const barGradient = ctx.createLinearGradient(padX, 0, width - padX, 0);
  if (isLight) {
    barGradient.addColorStop(0, 'rgba(20, 29, 43, .82)');
    barGradient.addColorStop(0.44, 'rgba(37, 99, 235, .96)');
    barGradient.addColorStop(1, 'rgba(79, 70, 229, .88)');
  } else {
    barGradient.addColorStop(0, 'rgba(248, 250, 252, .92)');
    barGradient.addColorStop(0.44, 'rgba(135, 226, 255, .96)');
    barGradient.addColorStop(1, 'rgba(110, 231, 189, .94)');
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = options.large ? 2.8 : 2.25;
  ctx.beginPath();
  sound.peaks.forEach(([min, max, rms], index) => {
    const x = padX + index * step;
    const loudness = Math.max(Math.abs(min), Math.abs(max), rms || 0);
    const boost = (options.large ? 0.92 : 0.82) + Math.min(0.2, loudness * 0.24);
    const y1 = midY + min * midY * boost;
    const y2 = midY + max * midY * boost;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  });
  ctx.strokeStyle = barGradient;
  ctx.stroke();
  ctx.restore();

  if (playedRatio > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(padX, padY, Math.max(0, playedX - padX), height - padY * 2);
    ctx.clip();
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = isLight ? 'rgba(37, 99, 235, .34)' : 'rgba(255,255,255,.9)';
    sound.peaks.forEach(([min, max], index) => {
      const x = padX + index * step;
      const h = Math.max(1, (max - min) * midY * 0.88);
      ctx.fillRect(x - 0.6, midY + min * midY * 0.88, Math.max(1.1, step * 0.45), h);
    });
    ctx.restore();
  }

  if (sound.duration) {
    drawHead(ctx, padX, usableWidth, height, sound.duration, options.playhead, headColor, options.large ? 2.6 : 2.2);
    if (options.hoverhead != null) drawHead(ctx, padX, usableWidth, height, sound.duration, options.hoverhead, hoverColor, 1.2);
  }
}

function drawHead(ctx, padX, usableWidth, height, duration, time, color, width) {
  if (time == null || !Number.isFinite(time)) return;
  const x = padX + Math.min(1, Math.max(0, time / duration)) * usableWidth;
  ctx.save();
  const glow = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
  glow.addColorStop(0, 'rgba(255,255,255,0)');
  glow.addColorStop(0.5, 'rgba(255,255,255,.16)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 18, 0, 36, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, 6, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function pointerTime(event, element, duration) {
  const rect = element.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  return ratio * duration;
}

function updateSelectionClasses() {
  els.soundList.querySelectorAll('[data-id]').forEach((item) => {
    item.classList.toggle('selected', item.dataset.id === state.previewId);
  });
}

function handleSoundContextAction(event) {
  const action = event.target.dataset.action;
  const sound = state.sounds.find((item) => item.id === state.activeContextId);
  if (!action || !sound) return;
  if (action === 'favorite') toggleFavorite(sound.id);
  if (action === 'reveal') window.soundLibrary.revealFile(sound.path);
  if (action === 'copyPath') {
    navigator.clipboard.writeText(sound.path);
    toast('已复制文件路径');
  }
  if (action === 'importResolve') {
    importSoundToDaVinci(sound);
  }
  if (action === 'moveToFolder') {
    if (isSystemFolder(state.selectedFolder)) {
      toast('请先选择一个自定义归类目录');
    } else {
      sound.libraryFolderId = state.selectedFolder;
      rebuildIndexes();
      saveState();
      renderAll(true);
      toast('已移动到当前归类目录');
    }
  }
  if (action === 'remove') {
    removeSound(sound.id);
    toast('已从素材库移除，原文件未删除');
  }
  hideContextMenus();
}

async function importSoundToDaVinci(sound) {
  if (!sound?.path) return;
  if (state.platform === 'win32' && isSharedWindowsPath(sound.path)) {
    toast('请先把音频放到 Windows 本地磁盘，再导入媒体池');
    return;
  }
  toast('正在导入到达芬奇媒体池');
  try {
    const result = await window.soundLibrary.importToDaVinci(sound.path);
    toast(result.ok ? '已导入到达芬奇媒体池' : result.message);
  } catch (error) {
    toast(error?.message || '导入到达芬奇失败');
  }
}

function handleFolderContextAction(event) {
  if (event.target.disabled) return;
  const action = event.target.dataset.folderAction;
  if (!action) return;
  hideContextMenus();
  if (action === 'checkMissing') checkMissingFiles();
  if (action === 'new') createFolder(state.activeFolderId);
  if (action === 'rename') renameFolder(state.activeFolderId);
  if (action === 'delete') deleteFolder(state.activeFolderId);
}

function createFolder(parentId) {
  const normalizedParentId = normalizeWritableFolderId(parentId);
  openNameDialog('新建归类目录', '', (name) => {
    const folder = { id: `folder:${Date.now()}`, name: name.trim(), parentId: normalizedParentId };
    state.folders.push(folder);
    rebuildIndexes();
    state.selectedFolder = folder.id;
    state.activeFolderId = folder.id;
    saveState();
    renderAll(true);
  });
}

function renameFolder(folderId) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder || folder.system) return toast('这个目录不能重命名');
  openNameDialog('重命名目录', folder.name, (name) => {
    folder.name = name.trim();
    rebuildIndexes();
    saveState();
    renderAll(true);
  });
}

function deleteFolder(folderId) {
  const targetIds = selectedWritableFolderIds(folderId);
  if (!targetIds.length) return toast('这个目录不能移除');
  const descendants = [...new Set(targetIds.flatMap((id) => [id, ...collectFolderDescendants(id)]))];
  const removedSoundIds = new Set(state.sounds.filter((sound) => descendants.includes(sound.libraryFolderId)).map((sound) => sound.id));
  state.sounds = state.sounds.filter((sound) => !descendants.includes(sound.libraryFolderId));
  state.folders = state.folders.filter((item) => !descendants.includes(item.id));
  rebuildIndexes();
  if (descendants.includes(state.selectedFolder)) state.selectedFolder = 'all';
  if (descendants.includes(state.activeFolderId)) state.activeFolderId = 'all';
  reconcileSoundSelection(removedSoundIds);
  state.selectedFolderIds = new Set();
  saveState();
  renderAll(true);
  toast('已从素材库移除目录和其中素材，原文件未删除');
}

function selectedWritableFolderIds(fallbackId) {
  const ids = state.selectedFolderIds.size ? [...state.selectedFolderIds] : [fallbackId];
  return ids.filter((id) => id && id !== 'all' && state.folders.some((folder) => folder.id === id && !folder.system));
}

function normalizeWritableFolderId(folderId) {
  if (!folderId || folderId === 'all') return 'all';
  return state.folders.some((folder) => folder.id === folderId) ? folderId : 'all';
}

function collectFolderDescendants(folderId) {
  const direct = state.folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id);
  return direct.flatMap((id) => [id, ...collectFolderDescendants(id)]);
}

function openNameDialog(title, value, onConfirm) {
  state.pendingDialog = onConfirm;
  els.nameDialogTitle.textContent = title;
  els.nameDialogInput.value = value;
  els.nameDialog.classList.add('show');
  requestAnimationFrame(() => {
    els.nameDialogInput.focus();
    els.nameDialogInput.select();
  });
}

function confirmNameDialog() {
  const value = els.nameDialogInput.value.trim();
  if (!value) return;
  const callback = state.pendingDialog;
  closeNameDialog();
  if (callback) callback(value);
}

function closeNameDialog() {
  state.pendingDialog = null;
  els.nameDialog.classList.remove('show');
}

function splitTags(value) {
  return value
    .split(/[\s,，、]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function autoGrowTagInput() {
  els.tagInput.style.height = 'auto';
  els.tagInput.style.height = `${Math.min(150, Math.max(58, els.tagInput.scrollHeight))}px`;
}

function showContextMenu(x, y) {
  hideContextMenus();
  const sound = state.sounds.find((item) => item.id === state.activeContextId);
  const favoriteButton = els.contextMenu.querySelector('[data-action="favorite"]');
  if (favoriteButton) favoriteButton.textContent = sound?.favorite ? '取消收藏' : '加入收藏';
  els.contextMenu.classList.add('show');
  placeMenu(els.contextMenu, x, y);
}

function showFolderContextMenu(x, y) {
  hideContextMenus();
  const writable = selectedWritableFolderIds(state.activeFolderId).length > 0;
  els.folderContextMenu.querySelector('[data-folder-action="checkMissing"]').disabled = !state.sounds.length || state.checkingMissing;
  els.folderContextMenu.querySelector('[data-folder-action="rename"]').disabled = !writable;
  els.folderContextMenu.querySelector('[data-folder-action="delete"]').disabled = !writable;
  els.folderContextMenu.classList.add('show');
  placeMenu(els.folderContextMenu, x, y);
}

function placeMenu(menu, x, y) {
  const margin = 10;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - margin);
  const top = Math.min(y, window.innerHeight - rect.height - margin);
  menu.style.left = `${Math.max(margin, left)}px`;
  menu.style.top = `${Math.max(margin, top)}px`;
}

function hideContextMenus() {
  els.contextMenu.classList.remove('show');
  els.folderContextMenu.classList.remove('show');
}

async function withLibraryWork(title, message, task) {
  showWorkOverlay(title, message);
  try {
    return await task();
  } catch (error) {
    toast(error?.message || '操作失败');
    throw error;
  } finally {
    if (!state.analyzing) hideWorkOverlay();
  }
}

function showWorkOverlay(title, message) {
  state.workOverlay.visible = true;
  state.workOverlay.title = title;
  state.workOverlay.message = message;
  state.workOverlay.done = 0;
  state.workOverlay.total = 0;
  updateWorkOverlay();
  els.workOverlay.classList.add('show');
  els.app.classList.add('is-busy');
}

function hideWorkOverlay() {
  state.workOverlay.visible = false;
  els.workOverlay.classList.remove('show');
  els.app.classList.remove('is-busy');
}

function setWorkProgress(done, total, message) {
  state.workOverlay.done = Math.max(0, done);
  state.workOverlay.total = Math.max(0, total);
  if (message) state.workOverlay.message = message;
  updateWorkOverlay();
}

function updateWorkOverlay() {
  const { title, message, done, total } = state.workOverlay;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  els.workTitle.textContent = title || '正在处理';
  els.workMessage.textContent = message || '请稍候，当前暂时不能操作素材库';
  els.workProgressBar.style.width = `${percent}%`;
  els.workProgressText.textContent = total > 0 ? `${percent}% · ${done}/${total}` : '准备中';
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function formatPrecise(seconds) {
  if (!Number.isFinite(seconds)) return '00:00.000';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function tick(now = performance.now()) {
  const selected = getPreviewSound();
  if (selected && state.audio?.dataset.id === selected.id) {
    state.playheadTime = state.audio.currentTime;
    renderTransport();
  }
  const introActive = now - state.waveStartedAt < 560;
  const playbackActive = Boolean(state.audio?.dataset.id);
  const hoverActive = Boolean(state.hoverSoundId);
  const duplicateActive = Boolean(state.duplicateDialogOpen && state.duplicateAudio);
  if (introActive || playbackActive || hoverActive || duplicateActive) {
    drawLargeWave(selected);
    if (playbackActive) drawItemWave(state.audio.dataset.id);
    if (hoverActive && state.hoverSoundId !== state.audio?.dataset.id) drawItemWave(state.hoverSoundId);
    if (duplicateActive) drawDuplicateWaves();
  }
  requestAnimationFrame(tick);
}

async function refreshCacheInfo(currentInfo = null) {
  if (refreshCacheInfo.pending && !currentInfo) return;
  if (refreshCacheInfo.pending && currentInfo) {
    els.libraryPath.textContent = currentInfo.storageDir || '-';
    els.cacheSize.textContent = formatBytes(currentInfo.waveCacheSize || 0);
    els.cachePath.textContent = currentInfo.waveCacheDir || '-';
    return;
  }
  refreshCacheInfo.pending = true;
  try {
    const info = currentInfo || await window.soundLibrary.getCacheInfo();
    els.libraryPath.textContent = info.storageDir || '-';
    els.cacheSize.textContent = formatBytes(info.waveCacheSize || 0);
    els.cachePath.textContent = info.waveCacheDir || '-';
  } catch {
    els.cacheSize.textContent = '无法读取';
  } finally {
    refreshCacheInfo.pending = false;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}
