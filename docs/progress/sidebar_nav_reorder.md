# 功能進度紀錄：左側選單項目拖曳重新排序 (Sidebar Nav Reordering)

- **紀錄時間**：2026-09-11
- **當前目標與背景**：
  在 Runboard 原生多頁面（`file:///` 協定）架構中，左側導覽列（Sidebar）負責提供各獨立工具頁面的頂層跳轉。原先導覽列項目為靜態硬編碼固定順序，為提升個人化使用體驗與快速存取常用工具，本次為左側選單增加「拖曳重新排序 (Drag & Drop Reorder)」功能。使用者可直接拖曳調整工具順序，系統具備跨頁狀態持久化與防誤觸跳轉保護機制，並提供一鍵重設按鈕以隨時恢復系統預設排序。

---

## 已完成事項清單

- [x] **HTML5 原生拖曳重排整合 (Drag & Drop Implementation)**：
  - 於 `js/nav.js` 為所有 `<li>` 注入 `draggable="true"` 與 `data-url` 識別標籤。
  - 將內部 `<a>` 標籤設定為 `draggable="false"`，徹底避免瀏覽器原生超連結拖曳機制（拖曳網址到桌面/網址列）干擾清單重排。
  - 支援向上/向下即時偵測中線位置，以 `insertBefore` 實現直覺換位。
- [x] **視覺反饋與樣式設計 (Visual Feedback & Affordance)**：
  - 更新 `css/style.css`，提供手勢抓取游標（`cursor: grab` / `cursor: grabbing`）。
  - 拖曳被抓取之項目套用 `.dragging`（0.35 柔和半透明樣式）。
  - 目標元素邊界依游標位置即時顯示專屬藍色放置指示線（`.drag-over-top` / `.drag-over-bottom`）與柔和發光陰影。
  - 項目右側新增淡入顯示的抓取指示圖示（`⋮⋮`）。
- [x] **防誤觸頁面跳轉機制 (Click Navigation Protection)**：
  - 在 `dragstart` 啟用 `isDragging` 狀態旗標。
  - 於 `a` 標籤點擊事件中攔截並呼叫 `preventDefault()` 與 `stopPropagation()`。
  - 於 `dragend` 透過延遲計時器（100ms）解除旗標，百分之百防止拖曳放開瞬間誤觸發頁面跳轉。
- [x] **跨頁狀態持久化 (Persistence via localStorage)**：
  - 拖曳放置完成後，即時收集最新順序並序列化至 `localStorage`（鍵名：`runboard_nav_order`）。
  - 每次頁面頂層換頁載入時，自動讀取該順序重新排列 `DEFAULT_NAV_ITEMS`。
  - 支援自動相容：未來若新增任何新工具項目，尚未記錄在已存陣列中的項目會自動依預設順序附加在末尾，確保新功能不漏接。
- [x] **一鍵重設預設排序 (Reset Action)**：
  - 在側邊欄頂部標題列新增次要重設按鈕（`#btn-reset-nav`，`↺ 重設`）。
  - 僅在偵測到有自訂順序時顯示；點擊後即刻清除 `localStorage` 並重新渲染回原始預設順序。

---

## 待辦事項 / 後續優化方向

- [ ] **側邊欄寬度拉伸 (Drag to Resize)**：
  - 支援拖曳側邊欄右側邊緣以自訂側邊欄寬度，並同步將寬度儲存至 `localStorage`。
- [ ] **自訂分組或自訂連結 (Custom Groups / Links)**：
  - 評估未來是否支援自訂分組標籤，或允許使用者手動新增外部網站捷徑至側邊欄。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [js/nav.js](file:///d:/Private/Runboard/js/nav.js) | 全域導覽元件邏輯 | 集中管理導覽項目清單、自訂順序讀寫（localStorage）、拖曳事件監聽、防跳轉保護與重設功能 |
| [css/style.css](file:///d:/Private/Runboard/css/style.css) | 全域共用樣式 | 側邊欄佈局、`.nav-links li` 拖曳手勢、`.dragging` 半透明、上下指示線與抓取手柄樣式 |
| [packager/src/CpeDesktop.csproj](file:///d:/Private/Runboard/packager/src/CpeDesktop.csproj) | 打包設定檔 | 編譯時自動將前端 HTML/CSS/JS 同步壓縮成桌面版安裝與發布資產 |
