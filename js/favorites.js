/**
 * Runboard - 常用網站 (Favorites) 專屬邏輯
 */
const FavoritesApp = (function () {
    let draggedItemInfo = null;
    let draggedCategoryInfo = null;

    function getFavorites() {
        const data = Storage.getData();
        if (!data.favorites) data.favorites = [];
        return data.favorites;
    }

    function render() {
        const listContainer = document.getElementById('favorites-list');
        if (!listContainer) return;

        const categories = getFavorites();
        let html = '';

        categories.forEach((cat, catIdx) => {
            const isCollapsed = cat.collapsed ? 'collapsed' : '';
            html += `
            <div class="category" ondragover="FavoritesApp.handleDragOver(event)" ondragleave="FavoritesApp.handleDragLeave(event)" ondrop="FavoritesApp.handleDrop(event, ${catIdx})">
                <div class="category-header">
                    <div class="category-title-area" draggable="true" ondragstart="FavoritesApp.handleCategoryDragStart(event, ${catIdx})" ondragend="FavoritesApp.handleCategoryDragEnd(event)" onclick="FavoritesApp.toggleCategory(${catIdx})">
                        <span class="toggle-icon ${isCollapsed}">▼</span>
                        <div class="category-name">${cat.category}</div>
                    </div>
                    <div>
                        <button class="btn btn-small" onclick="FavoritesApp.openAddItem(${catIdx})">＋新增項目</button>
                        <button class="btn btn-small" onclick="FavoritesApp.openEditCategory(${catIdx})">✏️</button>
                        <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="FavoritesApp.deleteCategory(${catIdx})">🗑️</button>
                    </div>
                </div>
                <div class="list-container ${isCollapsed}">
            `;

            if (cat.items) {
                cat.items.forEach((item, itemIdx) => {
                    html += `
                    <a href="${item.url || '#'}" target="_blank" class="item-card" draggable="true" ondragstart="FavoritesApp.handleDragStart(event, ${catIdx}, ${itemIdx})" ondragend="FavoritesApp.handleDragEnd(event)">
                        <button class="edit-btn" onclick="event.preventDefault(); FavoritesApp.openEditItem(${catIdx}, ${itemIdx})">✏️</button>
                        <button class="delete-btn" onclick="event.preventDefault(); FavoritesApp.deleteItem(${catIdx}, ${itemIdx})">✕</button>
                        <div class="item-title">${item.title}</div>
                        <div class="item-desc">${item.desc || ''}</div>
                    </a>
                    `;
                });
            }

            html += `</div></div>`;
        });

        listContainer.innerHTML = html;
    }

    // 收合分類
    async function toggleCategory(catIdx) {
        const cat = getFavorites()[catIdx];
        if (!cat) return;
        cat.collapsed = !cat.collapsed;
        await Storage.save();
        render();
    }

    // 拖曳處理
    function handleDragStart(event, catIdx, itemIdx) {
        event.stopPropagation();
        draggedItemInfo = { catIdx, itemIdx };
        draggedCategoryInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-item');
        setTimeout(() => {
            event.target.classList.add('dragging');
        }, 0);
    }

    function handleCategoryDragStart(event, catIdx) {
        event.stopPropagation();
        draggedCategoryInfo = { catIdx };
        draggedItemInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-category');
        setTimeout(() => {
            event.target.closest('.category').classList.add('dragging');
        }, 0);
    }

    function handleCategoryDragEnd(event) {
        event.target.closest('.category')?.classList.remove('dragging');
        draggedCategoryInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
    }

    function handleDragEnd(event) {
        event.target.classList.remove('dragging');
        draggedItemInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-over');
    }

    function handleDragLeave(event) {
        const catEl = event.currentTarget;
        if (!catEl.contains(event.relatedTarget)) {
            catEl.classList.remove('drag-over');
        }
    }

    async function handleDrop(event, targetCatIdx) {
        event.preventDefault();
        event.stopPropagation();
        const catEl = event.currentTarget;
        catEl.classList.remove('drag-over');

        const categories = getFavorites();

        if (draggedItemInfo) {
            const sourceCatIdx = draggedItemInfo.catIdx;
            const sourceItemIdx = draggedItemInfo.itemIdx;

            if (sourceCatIdx === targetCatIdx) return;

            const sourceList = categories[sourceCatIdx].items;
            const targetList = categories[targetCatIdx].items;

            const [movedItem] = sourceList.splice(sourceItemIdx, 1);
            targetList.push(movedItem);

            await Storage.save();
            render();
        } else if (draggedCategoryInfo) {
            const sourceCatIdx = draggedCategoryInfo.catIdx;
            if (sourceCatIdx === targetCatIdx) return;

            const [movedCat] = categories.splice(sourceCatIdx, 1);
            categories.splice(targetCatIdx, 0, movedCat);

            await Storage.save();
            render();
        }
    }

    // Modal 與 CRUD
    function openAddCategory() {
        Modal.open({
            title: '新增分類',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" placeholder="例如: 🎨 設計資源"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                getFavorites().push({ category: val, items: [], collapsed: false });
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditCategory(catIdx) {
        const cat = getFavorites()[catIdx];
        Modal.open({
            title: '編輯分類',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" value="${cat.category}"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                cat.category = val;
                await Storage.save();
                render();
                return true;
            }
        });
    }

    async function deleteCategory(catIdx) {
        if (!confirm('確定要刪除此分類及其所有項目嗎？')) return;
        getFavorites().splice(catIdx, 1);
        await Storage.save();
        render();
    }

    function openAddItem(catIdx) {
        Modal.open({
            title: '新增項目',
            html: `
                <div class="form-group"><label>名稱</label><input type="text" id="ipt-title" placeholder="例如: Google"></div>
                <div class="form-group"><label>網址/連結</label><input type="text" id="ipt-url" placeholder="https://..."></div>
                <div class="form-group"><label>補充說明 (選填)</label><input type="text" id="ipt-desc" placeholder="..."></div>
            `,
            onConfirm: async () => {
                const title = document.getElementById('ipt-title').value.trim();
                const url = document.getElementById('ipt-url').value.trim();
                const desc = document.getElementById('ipt-desc').value.trim();
                if (!title) {
                    alert('名稱為必填');
                    return false;
                }
                const cat = getFavorites()[catIdx];
                if (!cat.items) cat.items = [];
                cat.items.push({ title, url, desc });
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditItem(catIdx, itemIdx) {
        const item = getFavorites()[catIdx].items[itemIdx];
        Modal.open({
            title: '編輯項目',
            html: `
                <div class="form-group"><label>名稱</label><input type="text" id="ipt-title" value="${item.title || ''}"></div>
                <div class="form-group"><label>網址/連結</label><input type="text" id="ipt-url" value="${item.url || ''}"></div>
                <div class="form-group"><label>補充說明 (選填)</label><input type="text" id="ipt-desc" value="${item.desc || ''}"></div>
            `,
            onConfirm: async () => {
                const title = document.getElementById('ipt-title').value.trim();
                const url = document.getElementById('ipt-url').value.trim();
                const desc = document.getElementById('ipt-desc').value.trim();
                if (!title) {
                    alert('名稱為必填');
                    return false;
                }
                item.title = title;
                item.url = url;
                item.desc = desc;
                await Storage.save();
                render();
                return true;
            }
        });
    }

    async function deleteItem(catIdx, itemIdx) {
        if (!confirm('確定要刪除此項目嗎？')) return;
        getFavorites()[catIdx].items.splice(itemIdx, 1);
        await Storage.save();
        render();
    }

    // 初始化載入
    document.addEventListener('DOMContentLoaded', () => {
        Storage.init(() => {
            render();
        });
    });

    return {
        render,
        toggleCategory,
        handleDragStart,
        handleCategoryDragStart,
        handleCategoryDragEnd,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        openAddCategory,
        openEditCategory,
        deleteCategory,
        openAddItem,
        openEditItem,
        deleteItem
    };
})();

window.FavoritesApp = FavoritesApp;
