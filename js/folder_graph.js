/**
 * Runboard - 目錄節點圖 (Folder Graph)
 * 採用 Godot GraphNode / Unreal Blueprint 節點畫布風格
 * 遞迴掃描本機資料夾，並以節點連線圖視覺化呈現目錄架構與檔案分佈
 * 遵循 GEMINI.md 原生多頁與離線優先規範
 */
const FolderGraphApp = (function () {
    // 狀態變數
    let rawDirectoryTree = null; // 完整目錄樹狀結構
    let flatNodes = []; // 攤平之節點陣列
    let collapsedNodeIds = new Set(); // 被收合子樹的節點 ID
    let nodePositions = {}; // 節點座標快照 { [id]: { x, y } }
    let maxScanDepth = 3; // 預設深度限制
    let currentDirHandle = null;

    // 畫布視角狀態 (Pan & Zoom)
    let zoom = 1.0;
    let panX = 60;
    let panY = 80;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let isSpacePressed = false;

    // 節點拖曳狀態
    let isDraggingNode = false;
    let activeDragNodeId = null;
    let dragStartMouseX = 0;
    let dragStartMouseY = 0;
    let dragStartNodeX = 0;
    let dragStartNodeY = 0;

    // DOM 元素快取
    let dom = {};

    function initDOM() {
        dom.wrapper = document.getElementById('graph-view-wrapper');
        dom.canvas = document.getElementById('graph-canvas');
        dom.transformLayer = document.getElementById('graph-transform-layer');
        dom.svgLayer = document.getElementById('graph-svg-layer');
        dom.edgesGroup = document.getElementById('svg-edges-group');
        dom.nodesLayer = document.getElementById('graph-nodes-layer');
        dom.lblRootName = document.getElementById('lbl-root-name');
        dom.lblNodeCount = document.getElementById('lbl-node-count');
        dom.lblFileCount = document.getElementById('lbl-file-count');
        dom.lblZoom = document.getElementById('lbl-zoom');
        dom.selectDepth = document.getElementById('select-max-depth');
        dom.toast = document.getElementById('graph-toast');
    }

    /**
     * 輕量 Toast 提示
     */
    let toastTimer = null;
    function showToast(msg) {
        if (!dom.toast) return;
        dom.toast.innerText = msg;
        dom.toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            dom.toast.classList.remove('show');
        }, 2000);
    }

    /**
     * 遞迴掃描目錄核心
     */
    async function traverseDirectory(handle, relativePath = '', depth = 1, parentId = null) {
        const currentPath = relativePath ? `${relativePath}/${handle.name}` : handle.name;
        const id = 'node_' + Math.random().toString(36).substr(2, 9);

        const node = {
            id: id,
            name: handle.name,
            path: currentPath,
            depth: depth,
            parentId: parentId,
            childrenIds: [],
            directFileCount: 0,
            totalFileCount: 0,
            directFolderCount: 0,
            extStats: {}, // { [ext]: count }
            isCollapsed: false
        };

        const subDirectoryHandles = [];

        try {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    node.directFileCount++;
                    const nameParts = entry.name.split('.');
                    let ext = nameParts.length > 1 ? '.' + nameParts.pop().toLowerCase() : '(無副檔名)';
                    if (ext.length > 10) ext = ext.substring(0, 10);
                    node.extStats[ext] = (node.extStats[ext] || 0) + 1;
                } else if (entry.kind === 'directory') {
                    // 忽略隱藏的 git 等系統目錄，維持視覺整潔
                    if (!entry.name.startsWith('.git')) {
                        node.directFolderCount++;
                        subDirectoryHandles.push(entry);
                    }
                }
            }
        } catch (err) {
            console.warn(`讀取資料夾失敗 [${currentPath}]:`, err);
        }

        // 遞迴處理子資料夾（受 maxScanDepth 限制）
        const childrenNodes = [];
        let subFilesSum = 0;

        if (depth < maxScanDepth) {
            for (const subHandle of subDirectoryHandles) {
                const childNode = await traverseDirectory(subHandle, currentPath, depth + 1, id);
                node.childrenIds.push(childNode.id);
                childrenNodes.push(childNode);
                subFilesSum += childNode.totalFileCount;
            }
        }

        node.totalFileCount = node.directFileCount + subFilesSum;
        node.children = childrenNodes;
        return node;
    }

    /**
     * 攤平樹狀結構以便於圖論繪製與遍歷
     */
    function flattenTree(rootNode) {
        const list = [];
        function walk(node) {
            list.push(node);
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => walk(child));
            }
        }
        walk(rootNode);
        return list;
    }

    /**
     * 觸發目錄選擇並掃描
     */
    async function scanDirectory() {
        if (!window.showDirectoryPicker) {
            alert('您的瀏覽器不支援 showDirectoryPicker API，請使用 Chrome、Edge 等現代瀏覽器。');
            return;
        }

        try {
            const dirHandle = await window.showDirectoryPicker();
            if (!dirHandle) return;

            currentDirHandle = dirHandle;
            showToast(`開始掃描「${dirHandle.name}」...`);

            const rootNode = await traverseDirectory(dirHandle, '', 1, null);
            rawDirectoryTree = rootNode;
            flatNodes = flattenTree(rootNode);
            collapsedNodeIds.clear();

            // 自動排版計算座標
            computeAutoLayout();

            // 儲存快照至 data.json (如 GEMINI.md 規範)
            saveSnapshotToStorage();

            // 渲染至畫布
            renderGraph();
            updateToolbarInfo();
            showToast(`掃描完成！共解析 ${flatNodes.length} 個目錄節點`);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('掃描目錄錯誤:', err);
                alert('讀取目錄失敗: ' + (err.message || err));
            }
        }
    }

    /**
     * 保存快照至 Storage
     */
    function saveSnapshotToStorage() {
        if (!rawDirectoryTree) return;
        try {
            const data = Storage.getData();
            data.folderGraphSnapshot = {
                rootName: rawDirectoryTree.name,
                timestamp: new Date().toISOString(),
                maxScanDepth: maxScanDepth,
                tree: rawDirectoryTree,
                positions: nodePositions
            };
            Storage.save();
        } catch (e) {
            console.warn('快照儲存失敗:', e);
        }
    }

    /**
     * 從 Storage 快照還原
     */
    function loadSnapshotFromStorage() {
        const data = Storage.getData();
        if (data && data.folderGraphSnapshot && data.folderGraphSnapshot.tree) {
            const snap = data.folderGraphSnapshot;
            rawDirectoryTree = snap.tree;
            flatNodes = flattenTree(rawDirectoryTree);
            nodePositions = snap.positions || {};
            if (snap.maxScanDepth) {
                maxScanDepth = snap.maxScanDepth;
                if (dom.selectDepth) dom.selectDepth.value = String(maxScanDepth);
            }
            if (Object.keys(nodePositions).length === 0) {
                computeAutoLayout();
            }
            renderGraph();
            updateToolbarInfo();
            showToast(`已自動還原上次掃描之「${snap.rootName}」快照`);
        }
    }

    /**
     * 變更最大深度並依既有 Handle 重新掃描 (若有)
     */
    async function changeMaxDepth(val) {
        maxScanDepth = parseInt(val, 10) || 3;
        if (currentDirHandle) {
            showToast(`深度限制更新為 ${maxScanDepth}，重新掃描中...`);
            const rootNode = await traverseDirectory(currentDirHandle, '', 1, null);
            rawDirectoryTree = rootNode;
            flatNodes = flattenTree(rootNode);
            collapsedNodeIds.clear();
            computeAutoLayout();
            saveSnapshotToStorage();
            renderGraph();
            updateToolbarInfo();
        } else {
            showToast(`最大深度設定為 ${maxScanDepth} 層，請點擊「選取目錄掃描」生效`);
        }
    }

    /**
     * Left-to-Right DAG 樹狀自動排版
     * 橫向依 depth * 380，縱向依葉節點累計高度均勻分配避免重疊
     */
    function computeAutoLayout() {
        if (!rawDirectoryTree) return;

        const NODE_WIDTH = 320;
        const HORIZONTAL_GAP = 90;
        const NODE_HEIGHT = 160;
        const VERTICAL_GAP = 28;

        // 計算各子樹葉節點數量以分配 y 高度
        function getSubtreeLeafCount(node) {
            if (collapsedNodeIds.has(node.id) || !node.children || node.children.length === 0) {
                return 1;
            }
            let sum = 0;
            node.children.forEach(c => {
                sum += getSubtreeLeafCount(c);
            });
            return Math.max(1, sum);
        }

        let currentY = 100;

        function positionNode(node, startY) {
            const x = (node.depth - 1) * (NODE_WIDTH + HORIZONTAL_GAP) + 60;
            const leafCount = getSubtreeLeafCount(node);
            const totalBranchHeight = leafCount * (NODE_HEIGHT + VERTICAL_GAP);

            let nodeY = startY;

            if (node.children && node.children.length > 0 && !collapsedNodeIds.has(node.id)) {
                let childY = startY;
                node.children.forEach(child => {
                    const childLeaves = getSubtreeLeafCount(child);
                    const childH = childLeaves * (NODE_HEIGHT + VERTICAL_GAP);
                    positionNode(child, childY);
                    childY += childH;
                });
                // 父節點置中於子節點之間
                const firstChildY = nodePositions[node.children[0].id]?.y || startY;
                const lastChildY = nodePositions[node.children[node.children.length - 1].id]?.y || startY;
                nodeY = (firstChildY + lastChildY) / 2;
            } else {
                nodeY = startY;
            }

            nodePositions[node.id] = { x, y: nodeY };
        }

        positionNode(rawDirectoryTree, currentY);
    }

    /**
     * 自動排版並觸發重新渲染
     */
    function autoLayout() {
        if (!rawDirectoryTree) {
            showToast('尚未載入任何目錄');
            return;
        }
        computeAutoLayout();
        renderGraph();
        saveSnapshotToStorage();
        showToast('節點已重新自動排版完成');
    }

    /**
     * 重設縮放與視角
     */
    function resetView() {
        zoom = 1.0;
        panX = 60;
        panY = 80;
        applyTransform();
        updateZoomBadge();
        showToast('視角已重設 (100%)');
    }

    function applyTransform() {
        if (dom.transformLayer) {
            dom.transformLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        }
    }

    function updateZoomBadge() {
        if (dom.lblZoom) {
            dom.lblZoom.innerText = `${Math.round(zoom * 100)}%`;
        }
    }

    function updateToolbarInfo() {
        if (!rawDirectoryTree) {
            if (dom.lblRootName) dom.lblRootName.innerText = '未載入目錄';
            if (dom.lblNodeCount) dom.lblNodeCount.innerText = '0 個節點';
            if (dom.lblFileCount) dom.lblFileCount.innerText = '0 個檔案';
            return;
        }

        if (dom.lblRootName) dom.lblRootName.innerText = rawDirectoryTree.name;
        if (dom.lblNodeCount) dom.lblNodeCount.innerText = `${flatNodes.length} 個節點`;
        if (dom.lblFileCount) dom.lblFileCount.innerText = `${rawDirectoryTree.totalFileCount} 個檔案`;
        updateZoomBadge();
    }

    /**
     * 檢查指定節點是否有任一祖先節點被收合
     */
    function isNodeHiddenByAncestor(node) {
        if (!node.parentId) return false;
        let currentParentId = node.parentId;
        while (currentParentId) {
            if (collapsedNodeIds.has(currentParentId)) return true;
            const parent = flatNodes.find(n => n.id === currentParentId);
            currentParentId = parent ? parent.parentId : null;
        }
        return false;
    }

    /**
     * 切換收合/展開子樹
     */
    function toggleCollapse(nodeId, e) {
        if (e) e.stopPropagation();
        if (collapsedNodeIds.has(nodeId)) {
            collapsedNodeIds.delete(nodeId);
        } else {
            collapsedNodeIds.add(nodeId);
        }
        renderGraph();
    }

    /**
     * 複製路徑至剪貼簿
     */
    async function copyPath(path, e) {
        if (e) e.stopPropagation();
        try {
            await navigator.clipboard.writeText(path);
            showToast(`已複製路徑：${path}`);
        } catch (err) {
            showToast('複製失敗');
        }
    }

    /**
     * 取得副檔名標籤 HTML
     */
    function getExtCapsulesHtml(extStats) {
        const sorted = Object.entries(extStats).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) {
            return `<span style="font-size: 11px; color: var(--text-muted);">無直接檔案</span>`;
        }

        return sorted.map(([ext, count]) => {
            let colorClass = 'ext-default';
            if (ext === '.cs') colorClass = 'ext-cs';
            else if (ext === '.prefab') colorClass = 'ext-prefab';
            else if (['.png', '.jpg', '.jpeg', '.tga'].includes(ext)) colorClass = 'ext-png';
            else if (['.mat', '.shader', '.compute'].includes(ext)) colorClass = 'ext-mat';
            else if (ext === '.json') colorClass = 'ext-json';

            return `<span class="ext-capsule ${colorClass}">${ext}: ${count}</span>`;
        }).join('');
    }

    /**
     * 繪製貝茲曲線 (Bézier Curves)
     * M x1 y1 C (x1 + dx) y1, (x2 - dx) y2, x2 y2
     */
    function renderEdges() {
        if (!dom.edgesGroup) return;
        let svgHtml = '';

        const NODE_WIDTH = 300;
        // 輸入/輸出 Slot 位於標題列垂直高度約 19px
        const SLOT_OFFSET_Y = 19;

        flatNodes.forEach(node => {
            if (isNodeHiddenByAncestor(node)) return;
            if (collapsedNodeIds.has(node.id)) return; // 該節點已被收合，不連出給子節點

            const fromPos = nodePositions[node.id];
            if (!fromPos) return;

            const startX = fromPos.x + NODE_WIDTH + 6; // Output Slot
            const startY = fromPos.y + SLOT_OFFSET_Y;

            if (node.childrenIds && node.childrenIds.length > 0) {
                node.childrenIds.forEach(childId => {
                    const childNode = flatNodes.find(n => n.id === childId);
                    if (!childNode || isNodeHiddenByAncestor(childNode)) return;

                    const toPos = nodePositions[childId];
                    if (!toPos) return;

                    const endX = toPos.x - 6; // Input Slot
                    const endY = toPos.y + SLOT_OFFSET_Y;

                    const dx = Math.max(40, (endX - startX) * 0.5);
                    const cp1X = startX + dx;
                    const cp1Y = startY;
                    const cp2X = endX - dx;
                    const cp2Y = endY;

                    const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
                    svgHtml += `<path d="${d}" class="graph-edge" data-from="${node.id}" data-to="${childId}" />`;
                });
            }
        });

        dom.edgesGroup.innerHTML = svgHtml;
    }

    /**
     * 完整渲染畫布 (Nodes + Edges)
     */
    function renderGraph() {
        if (!dom.nodesLayer) return;

        if (!flatNodes || flatNodes.length === 0) {
            dom.nodesLayer.innerHTML = '';
            if (dom.edgesGroup) dom.edgesGroup.innerHTML = '';
            return;
        }

        // 渲染節點 DOM
        let nodesHtml = '';

        flatNodes.forEach(node => {
            if (isNodeHiddenByAncestor(node)) return;

            const pos = nodePositions[node.id] || { x: 60, y: 100 };
            const isRoot = node.parentId === null;
            const hasChildren = node.childrenIds && node.childrenIds.length > 0;
            const isCollapsed = collapsedNodeIds.has(node.id);

            const collapseBtnHtml = hasChildren
                ? `<button class="graph-node-btn-toggle" onclick="FolderGraphApp.toggleCollapse('${node.id}', event)" title="${isCollapsed ? '展開子節點' : '收合子節點'}">${isCollapsed ? '+' : '-'}</button>`
                : '';

            nodesHtml += `
            <div class="graph-node ${isRoot ? 'is-root' : ''} ${isCollapsed ? 'is-collapsed' : ''}"
                 id="node-el-${node.id}"
                 data-node-id="${node.id}"
                 style="transform: translate(${pos.x}px, ${pos.y}px);">
                
                ${!isRoot ? '<div class="graph-slot input-slot" title="父資料夾輸入"></div>' : ''}
                ${hasChildren ? '<div class="graph-slot output-slot" title="子資料夾輸出"></div>' : ''}

                <!-- Header -->
                <div class="graph-node-header" onmousedown="FolderGraphApp.onNodeHeaderMouseDown(event, '${node.id}')">
                    <div class="graph-node-title" title="${node.name}">
                        <span class="graph-node-title-icon">${isRoot ? '📦' : '📁'}</span>
                        <span>${node.name}</span>
                    </div>
                    <div class="graph-node-actions">
                        ${collapseBtnHtml}
                    </div>
                </div>

                <!-- Body -->
                <div class="graph-node-body">
                    <div class="graph-node-path" title="${node.path}">${node.path}</div>
                    
                    <div class="graph-node-stats-row">
                        <span class="graph-node-badge badge-highlight">📄 總計 ${node.totalFileCount} 檔</span>
                        <span class="graph-node-badge">直屬 ${node.directFileCount} 檔 / ${node.directFolderCount} 資料夾</span>
                    </div>

                    <div class="graph-node-tags">
                        ${getExtCapsulesHtml(node.extStats)}
                    </div>

                    <div class="graph-node-footer">
                        <button type="button" class="graph-node-copy-btn" onclick="FolderGraphApp.copyPath('${node.path.replace(/\\/g, '/')}', event)">
                            📋 複製路徑
                        </button>
                    </div>
                </div>
            </div>`;
        });

        dom.nodesLayer.innerHTML = nodesHtml;

        // 渲染貝茲曲線連線
        renderEdges();
    }

    /**
     * 節點拖曳互動 (Drag & Drop)
     */
    function onNodeHeaderMouseDown(e, nodeId) {
        if (e.button !== 0) return; // 僅限左鍵
        e.stopPropagation();

        isDraggingNode = true;
        activeDragNodeId = nodeId;
        dragStartMouseX = e.clientX;
        dragStartMouseY = e.clientY;

        const currentPos = nodePositions[nodeId] || { x: 0, y: 0 };
        dragStartNodeX = currentPos.x;
        dragStartNodeY = currentPos.y;

        const el = document.getElementById(`node-el-${nodeId}`);
        if (el) el.classList.add('is-selected');

        window.addEventListener('mousemove', onNodeMouseMove);
        window.addEventListener('mouseup', onNodeMouseUp);
    }

    function onNodeMouseMove(e) {
        if (!isDraggingNode || !activeDragNodeId) return;

        const dx = (e.clientX - dragStartMouseX) / zoom;
        const dy = (e.clientY - dragStartMouseY) / zoom;

        const newX = Math.round(dragStartNodeX + dx);
        const newY = Math.round(dragStartNodeY + dy);

        nodePositions[activeDragNodeId] = { x: newX, y: newY };

        // 局部高效更新該節點之 DOM transform
        const el = document.getElementById(`node-el-${activeDragNodeId}`);
        if (el) {
            el.style.transform = `translate(${newX}px, ${newY}px)`;
        }

        // 即時重繪貝茲曲線
        renderEdges();
    }

    function onNodeMouseUp(e) {
        if (isDraggingNode) {
            const el = document.getElementById(`node-el-${activeDragNodeId}`);
            if (el) el.classList.remove('is-selected');
            isDraggingNode = false;
            activeDragNodeId = null;
            saveSnapshotToStorage();
        }
        window.removeEventListener('mousemove', onNodeMouseMove);
        window.removeEventListener('mouseup', onNodeMouseUp);
    }

    /**
     * 畫布平移與縮放互動 (Pan & Zoom)
     */
    function setupCanvasInteractions() {
        if (!dom.canvas) return;

        // 滑鼠滾輪以指標為中心縮放 (Zoom: 0.2x ~ 2.0x)
        dom.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = dom.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.min(Math.max(0.2, zoom * zoomFactor), 2.0);

            // 以滑鼠目前位置為縮放錨點
            panX = mouseX - (mouseX - panX) * (newZoom / zoom);
            panY = mouseY - (mouseY - panY) * (newZoom / zoom);
            zoom = newZoom;

            applyTransform();
            updateZoomBadge();
        }, { passive: false });

        // 滑鼠中鍵、右鍵或空白鍵拖動畫布
        dom.canvas.addEventListener('mousedown', (e) => {
            // 中鍵 (1)、右鍵 (2) 或按住空白鍵時的左鍵 (0)
            if (e.button === 1 || e.button === 2 || (e.button === 0 && isSpacePressed)) {
                e.preventDefault();
                isPanning = true;
                panStartX = e.clientX - panX;
                panStartY = e.clientY - panY;
                dom.canvas.classList.add('is-panning');
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isPanning) {
                panX = e.clientX - panStartX;
                panY = e.clientY - panStartY;
                applyTransform();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (isPanning) {
                isPanning = false;
                dom.canvas.classList.remove('is-panning');
            }
        });

        // 阻擋畫布上的右鍵原生選單以便順暢 Pan
        dom.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // 鍵盤空白鍵輔助平移
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                isSpacePressed = true;
                dom.canvas.style.cursor = 'grab';
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                isSpacePressed = false;
                dom.canvas.style.cursor = '';
            }
        });
    }

    /**
     * 初始化入口 (遵循 GEMINI.md 規範)
     */
    function init() {
        initDOM();
        setupCanvasInteractions();
        applyTransform();

        // 透過 Storage.init 還原檔案連線與快照
        Storage.init(() => {
            loadSnapshotFromStorage();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 公開 API
    return {
        scanDirectory,
        autoLayout,
        resetView,
        changeMaxDepth,
        toggleCollapse,
        copyPath,
        onNodeHeaderMouseDown
    };
})();

window.FolderGraphApp = FolderGraphApp;
