# 功能進度紀錄：目錄節點圖 (Folder GraphNode Visualizer)

- **紀錄時間**：2026-09-09
- **當前目標與背景**：
  針對 Unity 遊戲開發者與深度專案工程師面臨的「專案資產結構龐大、資料夾階層極深、碎檔分佈不明」痛點，打造類似 Godot GraphNode / Unreal Blueprint / Unity ShaderGraph 風格的視覺化畫布工具。透過瀏覽器 File System Access API 遞迴遍歷目標目錄，以節點圖呈現各子目錄的檔案數量、副檔名分佈，並以平滑貝茲曲線連接階層關係，具備無限平移縮放與拖曳排版功能。

---

## 已完成事項清單

- [x] **實體多頁與防禦機制遵從 (`GEMINI.md`)**：
  - 建立專屬實體視圖 [folder_graph.html](file:///d:/Private/Runboard/folder_graph.html)，採用原生 `<a href="...">` 頁面跳轉。
  - 依序載入 `style.css`、`storage.js`、`nav.js`、`modal.js` 及專屬 `js/folder_graph.js`。
  - 嚴格維持離線優先，零外部 CDN，純原生 JavaScript (DOM + SVG) 打造。
  - 於 [js/nav.js](file:///d:/Private/Runboard/js/nav.js) 全域選單註冊 `{ title: '🗂️ 目錄節點圖', url: 'folder_graph.html' }`。
  - 於 [index.html](file:///d:/Private/Runboard/index.html) 與 [js/index.js](file:///d:/Private/Runboard/js/index.js) 儀表板整合目錄節點圖卡片與快照狀態。
- [x] **本機目錄遞迴遍歷與副檔名解析**：
  - 整合原生 `window.showDirectoryPicker()`，利用非同步迭代器高效遍歷目錄樹。
  - 自動統計各目錄直屬檔案數、資料夾數與遞迴累計總檔案數，略過 `.git` 等隱藏系統目錄。
  - 即時統計各目錄前 4 大副檔名分佈（如 `.cs`, `.prefab`, `.png`, `.mat`, `.json` 等）。
  - 支援將掃描快照寫入 `Storage.getData().folderGraphSnapshot` 並調用 `Storage.save()`，換頁自動恢復前次掃描。
- [x] **Godot GraphNode 節點視覺化設計**：
  - 科技暗色系卡片外觀（`#202024`）、圓角與微光陰影，根節點自帶金黃色頂部識別條。
  - 具備左側青色輸入插槽 (`Input Slot`) 與右側天藍色輸出插槽 (`Output Slot`)。
  - 醒目檔案總數徽章與副檔名專屬色彩膠囊標籤（`.cs` 綠、`.prefab` 藍、圖片黃、材質紫等）。
  - 卡片內建「📋 複製路徑」按鈕，一鍵複製目錄相對路徑至剪貼簿並彈出 Toast 提示。
- [x] **平滑貝茲曲線 (Bézier Curves) 動態連線**：
  - 畫布同層架設 SVG 圖層，採用平滑三次方貝茲曲線 (`M x1 y1 C ...`) 連接父子節點插槽。
  - 節點被拖動時，即時更新相鄰連線曲線幾何，操作極致流暢。
- [x] **無限畫布與互動體驗 (Pan & Zoom & Drag)**：
  - **滑鼠滾輪無級縮放**：以游標當前位置為錨點縮放（0.2x ~ 2.0x）。
  - **畫布平移**：支援按住滑鼠中鍵、右鍵或空白鍵拖動畫布。
  - **節點自由拖曳**：滑鼠按住節點標題列可任意拖放，搭配邊界外監聽不遺失焦點。
  - **展開 / 折疊子樹**：點擊標題列右側 `[-]` / `[+]` 即可收合或展開子目錄節點與連線。
  - **控制工具列**：具備「📁 選取目錄掃描」、「📐 自動排版 (Left-to-Right DAG)」、「🔍 重設視角 (1.0x)」與最大深度層數下拉選單 (1~6 層 / 全部)。

---

## 待辦事項 / 後續優化規劃

- [ ] **副檔名高亮與專屬過濾**：
  - 工具列提供輸入框或快捷按鈕（例如「僅計算 .cs 腳本」或「僅分析 Prefab」），即時重算各節點權重與隱藏無關節點。
- [ ] **Unity 特殊目錄預警標籤 (Resource Warnings)**：
  - 若偵測到路徑包含 `Resources/` 且檔案數超過警戒值（如 100 筆），節點自動以黃色/紅色警報標註，提醒避免啟動卡頓。
- [ ] **節點搜尋定位 (Node Search & Focus)**：
  - 支援輸入資料夾名稱，自動平移並將視角居中放大至目標節點。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [folder_graph.html](file:///d:/Private/Runboard/folder_graph.html) | 視圖頁面 | 目錄節點圖主介面、工具列與無級畫布容器結構 |
| [js/folder_graph.js](file:///d:/Private/Runboard/js/folder_graph.js) | 核心邏輯 | 目錄遞迴解析、DAG 自動排版、貝茲曲線即時繪製、Pan/Zoom 互動與快照存取 |
| [css/style.css](file:///d:/Private/Runboard/css/style.css) | 全域樣式 | 定義 GraphNode 面板、插槽圓點、副檔名標籤膠囊、SVG 連線與無限格線畫布 |
| [js/nav.js](file:///d:/Private/Runboard/js/nav.js) | 導覽組件 | 側邊欄全域註冊「🗂️ 目錄節點圖」導航項目 |
| [index.html](file:///d:/Private/Runboard/index.html) | 首頁視圖 | 工作區儀表板卡片介面 |
| [js/index.js](file:///d:/Private/Runboard/js/index.js) | 首頁邏輯 | 首頁儀表板整合目錄節點圖卡片數據與快速傳送門 |
| [data.json](file:///d:/Private/Runboard/data.json) | 資料來源 | 集中儲存目錄節點快照 `folderGraphSnapshot` |
