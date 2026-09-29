# 功能進度紀錄：🎡 美食大轉盤 (Food Roulette & Lucky Decision Wheel)

- **紀錄時間**：2026-09-29
- **當前目標與背景**：
  為 Runboard 工作區引入全新「🎡 美食大轉盤」工具，解決日常生活與辦公情境中最常見的「今天吃什麼？」選擇困難。使用者可以自訂範圍半徑（公尺）與數量上限，透過免金鑰、具備開放式 CORS 的 OpenStreetMap 官方 Nominatim API 抓取所在位置（或地名/地址搜尋）周邊真實美食店家，並由原生 HTML5 Canvas 幸運輪盤進行物理減速旋轉抽籤，中選後顯示步行預估距離、即時串接 Google Maps 導航，並可收藏至本機口袋名單中跨頁持久化保存。

---

## 已完成事項清單

- [x] **實體多頁與規範遵從 (`GEMINI.md`)**：
  - 建立專屬實體視圖 [food_roulette.html](file:///c:/JS_Source/WebApp/Runboard_HTML/food_roulette.html)，採用標準多頁跳轉與原生 App Shell 架構。
  - 引入全域基底樣式 `css/style.css` 與專屬樣式 [css/food_roulette.css](file:///c:/JS_Source/WebApp/Runboard_HTML/css/food_roulette.css)。
  - 依序載入核心組件 `js/storage.js`、`js/nav.js`、`js/modal.js` 及專屬邏輯 [js/food_roulette.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/food_roulette.js)（IIFE 模組化封裝）。
  - 於 [js/nav.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/nav.js) 全域選單註冊 `{ title: '🎡 美食大轉盤', url: 'food_roulette.html' }`，支援拖曳自訂排序與還原。
  - 於 [index.html](file:///c:/JS_Source/WebApp/Runboard_HTML/index.html) 與 [js/index.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/index.js) 首頁儀表板整合美食大轉盤卡片與口袋名單統計。
- [x] **資料核心擴充與持久化 (`data.json` & `js/storage.js`)**：
  - 在 `Storage` 模組中擴充 `data.foodPlaces` 讀取與寫入支援。
  - 於 `Source/data.json` 及 `Source/temp_data.json` 補充 `"foodPlaces": []` 結構。
- [x] **定位與周邊店家資料引擎 (OpenStreetMap Nominatim API)**：
  - 支援 HTML5 原生 GPS 地理定位 (`navigator.geolocation`)。
  - 支援地標/地址關鍵字搜尋（透過 Nominatim Geocoding API 即時反查經緯度）。
  - 依使用者座標與滑桿半徑動態計算經緯度邊界方框 (Viewbox: minLon, maxLat, maxLon, minLat)。
  - 使用 Haversine 公式精確計算店家與使用者的直線距離與步行時間預估（以 80m/min 換算）。
  - 嚴格剔除方框角落超出圓形半徑的店家，並由近至遠排序。
  - 克服 Overpass API 伺服器頻繁 406/限流問題，改採高可用之官方 Nominatim 搜尋服務。
- [x] **動態參數控制面板**：
  - **範圍半徑滑桿**：`300m` ~ `3000m`（預設 800m，即時回饋）。
  - **轉盤數量滑桿**：`4` ~ `24` 間（預設 12 間，視覺呈現最佳）。
  - **美食分類下拉**：全部美食、餐廳正餐、小吃速食、咖啡飲料甜點。
- [x] **Canvas 幸運大轉盤與真實物理動態**：
  - 高解析度 Retina/HiDPI 畫布渲染（`window.devicePixelRatio` 適配），扇形邊緣與字體銳利清晰。
  - 精選現代高對比度多彩調色盤，放射狀動態文字排版與外圈立體金屬鉚釘裝飾。
  - 頂端實體感紅三角指針，指針在跨越每個扇形時具備微震跳動回饋動效。
  - 真實物理減速旋轉（Ease-Out Cubic 緩動函數，旋轉 4.5~5.5 秒，隨機旋轉 6~10 圈）。
- [x] **無外部依賴之 Web Audio API 原生音效合成**：
  - 指針經過扇區時播放短促輕脆的 `tick` 喀噠聲（三角形波高頻衰減）。
  - 轉盤停定中獎時播放輕快的 C5-E5-G5-C6 琶音勝利提示音（Fanfare）。
  - 完全無需下載外部音訊檔案，純本機/離線環境隨開即用，支援一鍵開啟/關閉音效。
- [x] **彩帶紙花特效 (Confetti Particles)**：
  - 純手刻全螢幕 Canvas 彩色紙花粒子，中選瞬間噴發並依重力與旋轉飄落漸隱，零額外套件負擔。
- [x] **中選結果展示與 Google Maps 整合**：
  - 呈現中選店家名稱、精準距離、預估步行時間、分類標籤與周邊地址。
  - 「🗺️ 在 Google Maps 開啟 / 導航」按鈕：以標準 URL Scheme 直接在新分頁打開 Google 地圖進行即時導航與評價查看。
  - 「⭐ 收藏到口袋名單」按鈕：一鍵寫入 `data.json`。
  - 「🔄 再抽一次」按鈕：即時再次旋轉。
- [x] **口袋名單模式與自訂店家管理**：
  - 支援「🧭 附近即時探索」與「⭐ 我的口袋名單」雙模式切換。
  - 在口袋名單模式下支援離線抽籤。
  - 支援手動「＋ 新增口袋店家」調用共用 `Modal.open` 輸入自訂店家並寫入 `data.json`。
  - 候選清單提供 Checkbox 即時勾選排除今天不想吃的店家。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [food_roulette.html](file:///c:/JS_Source/WebApp/Runboard_HTML/food_roulette.html) | 頁面視圖 | 美食大轉盤獨立實體頁面，包含控制面板、Canvas 轉盤、結果卡片與候選清單 |
| [css/food_roulette.css](file:///c:/JS_Source/WebApp/Runboard_HTML/css/food_roulette.css) | 專屬樣式 | 雙層模組化之專屬 CSS，管理轉盤外框、滑桿排版、結果卡片、指針動效與候選網格 |
| [js/food_roulette.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/food_roulette.js) | 專屬邏輯 | 地理定位、Nominatim 搜尋、Haversine 距離換算、Canvas 旋轉物理學、Web Audio 音效合成與 Confetti 特效 |
| [js/storage.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/storage.js) | 核心資料層 | 增加 `data.foodPlaces` 欄位支援與跨頁面自動持久化 |
| [js/nav.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/nav.js) | 導覽組件 | 註冊「🎡 美食大轉盤」選單項目 |
| [index.html](file:///c:/JS_Source/WebApp/Runboard_HTML/index.html) | 首頁視圖 | 工作區儀表板新增美食大轉盤卡片與傳送門 |
| [js/index.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/index.js) | 首頁邏輯 | 動態統計口袋名單數量並更新儀表板數值 |
| [Source/data.json](file:///c:/JS_Source/WebApp/Runboard_HTML/Source/data.json) | 資料核心 | 擴充 `"foodPlaces": []` 欄位 |
| [Source/temp_data.json](file:///c:/JS_Source/WebApp/Runboard_HTML/Source/temp_data.json) | 資料範本 | 補充 `"foodPlaces": []` 預設結構 |
| [docs/progress/food_roulette.md](file:///c:/JS_Source/WebApp/Runboard_HTML/docs/progress/food_roulette.md) | 開發文件 | 本功能之架構設計、實作清單與維護文件 |

---

## 待辦事項 / 後續擴充規劃

- [ ] **轉盤權重加權功能**：
  - 支援為特別想吃的店家設定 2x / 3x 扇形面積加權。
- [ ] **價格區間篩選**：
  - 支援以預算區間（平價小吃 $ / 中價位 $$ / 大餐聚會 $$$）過濾候選。
- [ ] **歷史抽中紀錄**：
  - 記錄最近抽中並造訪的美食足跡，避免連續幾天抽到同一間。
