/**
 * Runboard - 核心資料存取與檔案連線管理
 * 結合 File System Access API 與 IndexedDB 快取
 * 支援跨頁面自動恢復檔案授權，免重複選取 data.json
 */
const Storage = (function () {
    const DB_NAME = 'RunboardStorage';
    const DB_VERSION = 1;
    const STORE_NAME = 'handles';
    const HANDLE_KEY = 'dataFileHandle';

    let fileHandle = null;
    let data = {
        favorites: [],
        notes: [],
        tasks: [],
        passwords: []
    };
    let isConnected = false;
    let onDataLoadedCallback = null;

    // 開啟或升級 IndexedDB
    function getDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // 儲存 FileHandle 至 IndexedDB
    async function saveHandleToDB(handle) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('儲存 Handle 至 IndexedDB 失敗:', e);
        }
    }

    // 從 IndexedDB 取出 FileHandle
    async function getHandleFromDB() {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('從 IndexedDB 讀取 Handle 失敗:', e);
            return null;
        }
    }

    // 檢查或請求權限
    async function verifyPermission(handle, readWrite = true) {
        const options = readWrite ? { mode: 'readwrite' } : {};
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    // 讀取檔案內容
    async function readDataFromFile(handle) {
        const file = await handle.getFile();
        const text = await file.text();
        const parsed = JSON.parse(text);
        // 確保結構完整
        data.favorites = parsed.favorites || [];
        data.notes = parsed.notes || [];
        data.tasks = parsed.tasks || [];
        data.passwords = parsed.passwords || [];
        isConnected = true;
        fileHandle = handle;
    }

    // 寫入檔案內容
    async function saveData() {
        if (!fileHandle || !isConnected) {
            console.warn('尚未連線檔案，無法儲存');
            return false;
        }
        try {
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 4));
            await writable.close();
            console.log('資料儲存成功');
            return true;
        } catch (e) {
            console.error('儲存失敗:', e);
            alert('自動儲存失敗，檔案權限可能已逾期，請點擊側邊欄重新授權。');
            updateUIStatus();
            return false;
        }
    }

    // 使用者手動選取檔案
    async function selectFile() {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'JSON 資料檔',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            if (handle) {
                await saveHandleToDB(handle);
                await readDataFromFile(handle);
                updateUIStatus();
                if (typeof onDataLoadedCallback === 'function') {
                    onDataLoadedCallback(data);
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('選取檔案失敗:', e);
            }
        }
    }

    // 點擊授權記憶中的檔案
    async function requestHandlePermission() {
        if (!fileHandle) return;
        try {
            const granted = await verifyPermission(fileHandle, true);
            if (granted) {
                await readDataFromFile(fileHandle);
                updateUIStatus();
                if (typeof onDataLoadedCallback === 'function') {
                    onDataLoadedCallback(data);
                }
            }
        } catch (e) {
            console.error('請求權限失敗:', e);
        }
    }

    // 匯出資料備份檔 (JSON)
    function exportBackup() {
        try {
            const pad = (n) => String(n).padStart(2, '0');
            const now = new Date();
            const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const filename = `runboard_backup_${timestamp}.json`;

            const jsonString = JSON.stringify(data, null, 4);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('匯出備份失敗:', e);
            alert('匯出備份失敗: ' + (e.message || e));
        }
    }

    // 更新側邊欄與頁面的連線狀態 UI
    function updateUIStatus() {
        const statusContainer = document.getElementById('file-status-area');
        if (!statusContainer) return;

        if (isConnected) {
            statusContainer.innerHTML = `
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; text-align: center;">
                    <span style="color: var(--success-color); font-weight: bold;">🟢 已連線 data.json</span><br>
                    修改將自動寫入檔案
                </div>
                <button class="btn btn-small" style="font-size: 11px; width: 100%; margin-bottom: 6px; color: var(--text-muted);" onclick="Storage.exportBackup()">📥 匯出備份檔</button>
                <button class="btn btn-small" style="font-size: 11px; width: 100%; color: var(--text-muted);" onclick="Storage.selectFile()">切換資料檔</button>
            `;
            const noDataMsg = document.getElementById('no-data-msg');
            if (noDataMsg) noDataMsg.style.display = 'none';
            const appContainer = document.getElementById('app-container');
            if (appContainer) appContainer.style.display = 'block';
        } else if (fileHandle) {
            // 記憶中有 handle，但需要使用者點擊手勢授權
            statusContainer.innerHTML = `
                <div style="font-size: 12px; color: #fbbf24; margin-bottom: 8px; text-align: center;">
                    🟡 已記憶檔案位置<br>需點擊以恢復權限
                </div>
                <button class="btn primary" onclick="Storage.requestHandlePermission()">⚡ 恢復檔案連線</button>
                <button class="btn btn-small" style="font-size: 11px; width: 100%; margin-top: 6px; color: var(--text-muted);" onclick="Storage.selectFile()">重新選擇檔案</button>
            `;
            const noDataMsg = document.getElementById('no-data-msg');
            if (noDataMsg) noDataMsg.style.display = 'block';
            const appContainer = document.getElementById('app-container');
            if (appContainer) appContainer.style.display = 'none';
        } else {
            statusContainer.innerHTML = `
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; text-align: center;">
                    🔴 尚未連線<br>請授權讀取 data.json
                </div>
                <button class="btn primary" onclick="Storage.selectFile()">📂 選擇 data.json 檔案</button>
            `;
            const noDataMsg = document.getElementById('no-data-msg');
            if (noDataMsg) noDataMsg.style.display = 'block';
            const appContainer = document.getElementById('app-container');
            if (appContainer) appContainer.style.display = 'none';
        }
    }

    // 初始化入口：換頁自動執行
    async function init(callback) {
        onDataLoadedCallback = callback;
        try {
            const cachedHandle = await getHandleFromDB();
            if (cachedHandle) {
                fileHandle = cachedHandle;
                // 檢查是否已有讀寫權限
                const permission = await cachedHandle.queryPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    await readDataFromFile(cachedHandle);
                    updateUIStatus();
                    if (typeof onDataLoadedCallback === 'function') {
                        onDataLoadedCallback(data);
                    }
                    return;
                }
            }
        } catch (e) {
            console.warn('自動連線快取失敗:', e);
        }
        updateUIStatus();
    }

    return {
        init,
        getData: () => data,
        save: saveData,
        selectFile,
        requestHandlePermission,
        updateUIStatus,
        exportBackup,
        get isConnected() { return isConnected; }
    };
})();

window.Storage = Storage;
