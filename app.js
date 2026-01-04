/* ========================================
   きょう何食べる？ - メインアプリケーション
======================================== */

// ========================================
// データ管理
// ========================================

const STORAGE_KEYS = {
    RECIPES: 'kyou_nani_recipes',
    MEALS: 'kyou_nani_meals',
    SHOPPING: 'kyou_nani_shopping',
    STAPLES: 'kyou_nani_staples'
};

// 買い物リスト生成時に除外する調味料
const EXCLUDED_INGREDIENTS = [
    '水', '醤油', 'しょうゆ', 'みりん', '砂糖', '塩', '塩こしょう',
    '酒', '料理酒', '酢', 'サラダ油', 'ごま油', 'オリーブオイル',
    'だし汁', 'だしの素', 'コンソメ', '味噌', 'みそ',
    'ケチャップ', 'マヨネーズ', 'ソース', 'ウスターソース',
    'こしょう', 'コショウ', '胡椒', '片栗粉', '小麦粉', 'バター'
];

// データ読み込み
function loadData(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('データ読み込みエラー:', e);
        return defaultValue;
    }
}

// データ保存
function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('データ保存エラー:', e);
    }
}

// レシピデータを初期化
function initRecipes() {
    let recipes = loadData(STORAGE_KEYS.RECIPES);
    if (!recipes || recipes.length === 0) {
        recipes = [...DEFAULT_RECIPES];
        saveData(STORAGE_KEYS.RECIPES, recipes);
    }
    return recipes;
}

// グローバル状態
let recipes = initRecipes();
let meals = loadData(STORAGE_KEYS.MEALS, {});
let shoppingList = loadData(STORAGE_KEYS.SHOPPING, { items: [] });
let staples = loadData(STORAGE_KEYS.STAPLES, { items: [] });

// 現在の表示月
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();

// 選択中の日付
let selectedDate = null;

// ========================================
// ビュー切り替え
// ========================================

const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    document.getElementById(`${viewId}-view`).classList.add('active');
    document.querySelector(`[data-view="${viewId}"]`).classList.add('active');

    // ビューに応じた初期化
    if (viewId === 'calendar') {
        renderCalendar();
    } else if (viewId === 'recipes') {
        renderRecipesList();
    } else if (viewId === 'shopping') {
        renderShoppingList();
        renderStaplesList();
    }
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        switchView(item.dataset.view);
    });
});

// ========================================
// カレンダー
// ========================================

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

function renderCalendar() {
    const year = currentYear;
    const month = currentMonth;

    // 月タイトル更新
    currentMonthEl.textContent = `${year}年${month + 1}月`;

    // カレンダーグリッドをクリア
    calendarGrid.innerHTML = '';

    // 月の最初の日と最後の日
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // 最初の日の曜日（0=日曜）
    const startDayOfWeek = firstDay.getDay();

    // 空のセルを追加
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
    }

    // 今日の日付
    const today = new Date();
    const todayStr = formatDate(today);

    // 日付セルを追加
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = formatDate(new Date(year, month, day));
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        // 今日かどうか
        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }

        // 献立があるかどうか
        const dayMeals = meals[dateStr];
        if (dayMeals && dayMeals.length > 0) {
            dayCell.classList.add('has-meal');
        }

        // 日付表示
        const dateSpan = document.createElement('span');
        dateSpan.className = 'date';
        dateSpan.textContent = day;
        dayCell.appendChild(dateSpan);

        // 献立ドット
        if (dayMeals && dayMeals.length > 0) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'meal-dots';
            const dotCount = Math.min(dayMeals.length, 3);
            for (let i = 0; i < dotCount; i++) {
                const dot = document.createElement('span');
                dot.className = 'meal-dot';
                dotsContainer.appendChild(dot);
            }
            dayCell.appendChild(dotsContainer);
        }

        // クリックイベント
        dayCell.addEventListener('click', () => {
            openRecipeSelectModal(dateStr, day);
        });

        calendarGrid.appendChild(dayCell);
    }
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

prevMonthBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
});

// ========================================
// レシピ選択モーダル
// ========================================

const recipeSelectModal = document.getElementById('recipe-select-modal');
const modalDateTitle = document.getElementById('modal-date-title');
const selectedRecipesContainer = document.getElementById('selected-recipes');
const modalRecipesList = document.getElementById('modal-recipes-list');
const modalCategoryFilter = recipeSelectModal.querySelector('.modal-category-filter');

let currentModalCategory = 'all';

function openRecipeSelectModal(dateStr, day) {
    selectedDate = dateStr;
    modalDateTitle.textContent = `${currentMonth + 1}月${day}日の献立`;
    currentModalCategory = 'all';

    // カテゴリフィルターをリセット
    modalCategoryFilter.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === 'all');
    });

    renderSelectedRecipes();
    renderModalRecipesList();
    recipeSelectModal.classList.add('active');
}

function renderSelectedRecipes() {
    const dayMeals = meals[selectedDate] || [];
    selectedRecipesContainer.innerHTML = '';

    if (dayMeals.length === 0) {
        selectedRecipesContainer.innerHTML = '<p style="color: var(--text-light); font-size: 0.875rem;">まだレシピが選択されていません</p>';
        return;
    }

    dayMeals.forEach(recipeId => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        const tag = document.createElement('div');
        tag.className = 'selected-recipe-tag';
        tag.innerHTML = `
      ${recipe.name}
      <button data-id="${recipe.id}">&times;</button>
    `;
        tag.querySelector('button').addEventListener('click', () => {
            removeRecipeFromDay(recipeId);
        });
        selectedRecipesContainer.appendChild(tag);
    });
}

function renderModalRecipesList() {
    const dayMeals = meals[selectedDate] || [];
    const filteredRecipes = currentModalCategory === 'all'
        ? recipes
        : recipes.filter(r => r.category === currentModalCategory);

    modalRecipesList.innerHTML = '';

    filteredRecipes.forEach(recipe => {
        const item = document.createElement('div');
        item.className = 'modal-recipe-item';
        if (dayMeals.includes(recipe.id)) {
            item.classList.add('selected');
        }
        item.innerHTML = `
      <span>${recipe.name}</span>
      <span style="font-size: 0.75rem; opacity: 0.7;">${recipe.category}</span>
    `;
        item.addEventListener('click', () => {
            if (dayMeals.includes(recipe.id)) {
                removeRecipeFromDay(recipe.id);
            } else {
                addRecipeToDay(recipe.id);
            }
        });
        modalRecipesList.appendChild(item);
    });
}

function addRecipeToDay(recipeId) {
    if (!meals[selectedDate]) {
        meals[selectedDate] = [];
    }
    if (!meals[selectedDate].includes(recipeId)) {
        meals[selectedDate].push(recipeId);
        saveData(STORAGE_KEYS.MEALS, meals);
        renderSelectedRecipes();
        renderModalRecipesList();
    }
}

function removeRecipeFromDay(recipeId) {
    if (meals[selectedDate]) {
        meals[selectedDate] = meals[selectedDate].filter(id => id !== recipeId);
        if (meals[selectedDate].length === 0) {
            delete meals[selectedDate];
        }
        saveData(STORAGE_KEYS.MEALS, meals);
        renderSelectedRecipes();
        renderModalRecipesList();
    }
}

// モーダルカテゴリフィルター
modalCategoryFilter.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
        currentModalCategory = e.target.dataset.category;
        modalCategoryFilter.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === currentModalCategory);
        });
        renderModalRecipesList();
    }
});

// ========================================
// レシピ一覧
// ========================================

const recipesListEl = document.getElementById('recipes-list');
const categoryFilterEl = document.querySelector('.recipes-header .category-filter');
const addRecipeBtn = document.getElementById('add-recipe-btn');

let currentCategory = 'all';

function renderRecipesList() {
    const filteredRecipes = currentCategory === 'all'
        ? recipes
        : recipes.filter(r => r.category === currentCategory);

    recipesListEl.innerHTML = '';

    if (filteredRecipes.length === 0) {
        recipesListEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <p>レシピがありません</p>
      </div>
    `;
        return;
    }

    filteredRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.innerHTML = `
      <div class="recipe-card-content">
        <div class="recipe-card-name">${recipe.name}</div>
        <span class="recipe-card-category">${recipe.category}</span>
      </div>
      <span class="recipe-card-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </span>
    `;
        card.addEventListener('click', () => {
            openRecipeDetailModal(recipe);
        });
        recipesListEl.appendChild(card);
    });
}

categoryFilterEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
        currentCategory = e.target.dataset.category;
        categoryFilterEl.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === currentCategory);
        });
        renderRecipesList();
    }
});

// ========================================
// レシピ詳細/編集モーダル
// ========================================

const recipeDetailModal = document.getElementById('recipe-detail-modal');
const recipeModalTitle = document.getElementById('recipe-modal-title');
const recipeForm = document.getElementById('recipe-form');
const recipeIdInput = document.getElementById('recipe-id');
const recipeNameInput = document.getElementById('recipe-name');
const recipeCategorySelect = document.getElementById('recipe-category');
const ingredientsList = document.getElementById('ingredients-list');
const recipeInstructionsInput = document.getElementById('recipe-instructions');
const addIngredientBtn = document.getElementById('add-ingredient-btn');
const deleteRecipeBtn = document.getElementById('delete-recipe-btn');

function openRecipeDetailModal(recipe = null) {
    if (recipe) {
        recipeModalTitle.textContent = 'レシピ編集';
        recipeIdInput.value = recipe.id;
        recipeNameInput.value = recipe.name;
        recipeCategorySelect.value = recipe.category;
        recipeInstructionsInput.value = recipe.instructions || '';
        deleteRecipeBtn.style.display = 'block';

        // 材料リストを構築
        ingredientsList.innerHTML = '';
        (recipe.ingredients || []).forEach(ing => {
            addIngredientRow(ing.name, ing.amount);
        });
    } else {
        recipeModalTitle.textContent = '新しいレシピ';
        recipeIdInput.value = '';
        recipeNameInput.value = '';
        recipeCategorySelect.value = '主菜';
        recipeInstructionsInput.value = '';
        deleteRecipeBtn.style.display = 'none';

        ingredientsList.innerHTML = '';
        addIngredientRow('', '');
    }

    recipeDetailModal.classList.add('active');
}

function addIngredientRow(name = '', amount = '') {
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = `
    <input type="text" class="input" placeholder="材料名" value="${name}">
    <input type="text" class="input" placeholder="量" value="${amount}">
    <button type="button">&times;</button>
  `;
    row.querySelector('button').addEventListener('click', () => {
        row.remove();
    });
    ingredientsList.appendChild(row);
}

addIngredientBtn.addEventListener('click', () => {
    addIngredientRow();
});

addRecipeBtn.addEventListener('click', () => {
    openRecipeDetailModal();
});

recipeForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = recipeIdInput.value || `recipe_${Date.now()}`;
    const name = recipeNameInput.value.trim();
    const category = recipeCategorySelect.value;
    const instructions = recipeInstructionsInput.value.trim();

    // 材料を収集
    const ingredients = [];
    ingredientsList.querySelectorAll('.ingredient-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const ingName = inputs[0].value.trim();
        const ingAmount = inputs[1].value.trim();
        if (ingName) {
            ingredients.push({ name: ingName, amount: ingAmount });
        }
    });

    if (!name) {
        alert('レシピ名を入力してください');
        return;
    }

    const existingIndex = recipes.findIndex(r => r.id === id);
    const newRecipe = { id, name, category, ingredients, instructions };

    if (existingIndex >= 0) {
        recipes[existingIndex] = newRecipe;
    } else {
        recipes.push(newRecipe);
    }

    saveData(STORAGE_KEYS.RECIPES, recipes);
    recipeDetailModal.classList.remove('active');
    renderRecipesList();
});

deleteRecipeBtn.addEventListener('click', () => {
    const id = recipeIdInput.value;
    if (!id) return;

    if (confirm('このレシピを削除しますか？')) {
        recipes = recipes.filter(r => r.id !== id);
        saveData(STORAGE_KEYS.RECIPES, recipes);

        // 献立からも削除
        Object.keys(meals).forEach(date => {
            meals[date] = meals[date].filter(rid => rid !== id);
            if (meals[date].length === 0) {
                delete meals[date];
            }
        });
        saveData(STORAGE_KEYS.MEALS, meals);

        recipeDetailModal.classList.remove('active');
        renderRecipesList();
    }
});

// ========================================
// 買い物メモ
// ========================================

const shoppingListEl = document.getElementById('shopping-list');
const generateListBtn = document.getElementById('generate-list-btn');
const newItemInput = document.getElementById('new-item-input');
const addItemBtn = document.getElementById('add-item-btn');
const dateRangeModal = document.getElementById('date-range-modal');
const dateStartInput = document.getElementById('date-start');
const dateEndInput = document.getElementById('date-end');
const generateConfirmBtn = document.getElementById('generate-confirm-btn');

function renderShoppingList() {
    shoppingListEl.innerHTML = '';

    if (shoppingList.items.length === 0) {
        shoppingListEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <path d="M3 6h18"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <p>買い物リストは空です</p>
      </div>
    `;
        return;
    }

    shoppingList.items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = `shopping-item ${item.checked ? 'checked' : ''}`;
        itemEl.innerHTML = `
      <div class="item-checkbox ${item.checked ? 'checked' : ''}" data-id="${item.id}"></div>
      <span class="item-name">${item.name}</span>
      <button class="item-delete" data-id="${item.id}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;

        itemEl.querySelector('.item-checkbox').addEventListener('click', () => {
            toggleShoppingItem(item.id);
        });

        itemEl.querySelector('.item-delete').addEventListener('click', () => {
            deleteShoppingItem(item.id);
        });

        shoppingListEl.appendChild(itemEl);
    });
}

function toggleShoppingItem(id) {
    const item = shoppingList.items.find(i => i.id === id);
    if (item) {
        item.checked = !item.checked;
        saveData(STORAGE_KEYS.SHOPPING, shoppingList);
        renderShoppingList();
    }
}

function deleteShoppingItem(id) {
    shoppingList.items = shoppingList.items.filter(i => i.id !== id);
    saveData(STORAGE_KEYS.SHOPPING, shoppingList);
    renderShoppingList();
}

function addShoppingItem(name) {
    if (!name.trim()) return;

    shoppingList.items.push({
        id: `item_${Date.now()}`,
        name: name.trim(),
        checked: false
    });
    saveData(STORAGE_KEYS.SHOPPING, shoppingList);
    renderShoppingList();
}

addItemBtn.addEventListener('click', () => {
    addShoppingItem(newItemInput.value);
    newItemInput.value = '';
});

newItemInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addShoppingItem(newItemInput.value);
        newItemInput.value = '';
    }
});

// チェック済みアイテムを一括削除
const deleteCheckedBtn = document.getElementById('delete-checked-btn');

function deleteCheckedItems() {
    const checkedItems = shoppingList.items.filter(i => i.checked);
    if (checkedItems.length === 0) {
        return;
    }
    shoppingList.items = shoppingList.items.filter(i => !i.checked);
    saveData(STORAGE_KEYS.SHOPPING, shoppingList);
    renderShoppingList();
}

deleteCheckedBtn.addEventListener('click', deleteCheckedItems);

// 献立から生成
generateListBtn.addEventListener('click', () => {
    // デフォルト値を設定（今日から1週間）
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 6);

    dateStartInput.value = formatDate(today);
    dateEndInput.value = formatDate(endDate);

    dateRangeModal.classList.add('active');
});

generateConfirmBtn.addEventListener('click', () => {
    const startDate = new Date(dateStartInput.value);
    const endDate = new Date(dateEndInput.value);

    if (isNaN(startDate) || isNaN(endDate)) {
        alert('日付を正しく入力してください');
        return;
    }

    if (startDate > endDate) {
        alert('開始日は終了日より前にしてください');
        return;
    }

    // 期間内の献立から材料を収集（除外調味料はスキップ）
    const ingredientMap = new Map();

    let currentDay = new Date(startDate);
    while (currentDay <= endDate) {
        const dateStr = formatDate(currentDay);
        const dayMeals = meals[dateStr] || [];

        dayMeals.forEach(recipeId => {
            const recipe = recipes.find(r => r.id === recipeId);
            if (recipe && recipe.ingredients) {
                recipe.ingredients.forEach(ing => {
                    const key = ing.name;
                    // 除外調味料をスキップ
                    const isExcluded = EXCLUDED_INGREDIENTS.some(excluded =>
                        key.includes(excluded) || excluded.includes(key)
                    );
                    if (isExcluded) return;

                    if (ingredientMap.has(key)) {
                        const existing = ingredientMap.get(key);
                        existing.amounts.push(ing.amount);
                    } else {
                        ingredientMap.set(key, { name: ing.name, amounts: [ing.amount] });
                    }
                });
            }
        });

        currentDay.setDate(currentDay.getDate() + 1);
    }

    // 既存のリストをクリアして新しいリストを作成
    shoppingList.items = [];

    ingredientMap.forEach((value, key) => {
        const amountStr = value.amounts.length > 1
            ? value.amounts.join('、')
            : value.amounts[0];
        shoppingList.items.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: amountStr ? `${value.name}（${amountStr}）` : value.name,
            checked: false
        });
    });

    saveData(STORAGE_KEYS.SHOPPING, shoppingList);
    dateRangeModal.classList.remove('active');
    renderShoppingList();
    renderStaplesList();
});

// ========================================
// 常備品管理
// ========================================

const staplesListEl = document.getElementById('staples-list');
const newStapleInput = document.getElementById('new-staple-input');
const addStapleBtn = document.getElementById('add-staple-btn');

function renderStaplesList() {
    staplesListEl.innerHTML = '';

    if (staples.items.length === 0) {
        staplesListEl.innerHTML = '<p style="color: var(--text-light); font-size: 0.875rem;">常備品を追加してください</p>';
        return;
    }

    staples.items.forEach((item, index) => {
        const itemEl = document.createElement('div');
        const statusClass = item.inStock ? 'in-stock' : 'out-of-stock';
        const statusText = item.inStock ? '✓ あり' : '✗ なし';

        itemEl.className = `staple-item ${statusClass}`;
        itemEl.draggable = true;
        itemEl.dataset.index = index;
        itemEl.innerHTML = `
            <span class="staple-name">${item.name}</span>
            <span class="staple-status">${statusText}</span>
            <button class="staple-delete" data-id="${item.id}">&times;</button>
        `;

        // タップで在庫切り替え（削除ボタン以外、ドラッグ中でなければ）
        itemEl.addEventListener('click', (e) => {
            if (!e.target.classList.contains('staple-delete') && !itemEl.classList.contains('dragging')) {
                toggleStapleStock(item.id);
            }
        });

        itemEl.querySelector('.staple-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteStaple(item.id);
        });

        // ドラッグ&ドロップイベント
        itemEl.addEventListener('dragstart', handleDragStart);
        itemEl.addEventListener('dragend', handleDragEnd);
        itemEl.addEventListener('dragover', handleDragOver);
        itemEl.addEventListener('drop', handleDrop);

        // タッチイベント（長押しでドラッグ）
        setupTouchDrag(itemEl, index);

        staplesListEl.appendChild(itemEl);
    });
}

// ========================================
// ドラッグ&ドロップ（デスクトップ）
// ========================================

let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(e.target.dataset.index);
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.staple-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.staple-item');
    if (target && !target.classList.contains('dragging')) {
        document.querySelectorAll('.staple-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        target.classList.add('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.staple-item');
    if (!target) return;

    const targetIndex = parseInt(target.dataset.index);
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        reorderStaples(draggedIndex, targetIndex);
    }
    draggedIndex = null;
}

function reorderStaples(fromIndex, toIndex) {
    const item = staples.items.splice(fromIndex, 1)[0];
    staples.items.splice(toIndex, 0, item);
    saveData(STORAGE_KEYS.STAPLES, staples);
    renderStaplesList();
}

// ========================================
// タッチドラッグ（モバイル長押し）
// ========================================

let touchStartTimer = null;
let touchDragging = false;
let touchDraggedEl = null;
let touchDraggedIndex = null;
let touchClone = null;

function setupTouchDrag(itemEl, index) {
    itemEl.addEventListener('touchstart', (e) => {
        // 長押し検出（500ms）
        touchStartTimer = setTimeout(() => {
            touchDragging = true;
            touchDraggedEl = itemEl;
            touchDraggedIndex = index;
            itemEl.classList.add('dragging');

            // ドラッグ用のクローンを作成
            touchClone = itemEl.cloneNode(true);
            touchClone.classList.add('touch-clone');
            touchClone.style.position = 'fixed';
            touchClone.style.pointerEvents = 'none';
            touchClone.style.zIndex = '1000';
            touchClone.style.opacity = '0.8';
            touchClone.style.width = itemEl.offsetWidth + 'px';
            document.body.appendChild(touchClone);

            const touch = e.touches[0];
            touchClone.style.left = (touch.clientX - itemEl.offsetWidth / 2) + 'px';
            touchClone.style.top = (touch.clientY - 20) + 'px';

            // バイブレーション（対応している場合）
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 500);
    }, { passive: true });

    itemEl.addEventListener('touchmove', (e) => {
        if (touchDragging && touchClone) {
            e.preventDefault(); // 画面スクロールを防止
            const touch = e.touches[0];
            touchClone.style.left = (touch.clientX - touchDraggedEl.offsetWidth / 2) + 'px';
            touchClone.style.top = (touch.clientY - 20) + 'px';

            // ドロップ先を探す
            const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetItem = targetEl?.closest('.staple-item');

            document.querySelectorAll('.staple-item').forEach(item => {
                item.classList.remove('drag-over');
            });

            if (targetItem && targetItem !== touchDraggedEl) {
                targetItem.classList.add('drag-over');
            }
        } else {
            clearTimeout(touchStartTimer);
        }
    }, { passive: false });

    itemEl.addEventListener('touchend', (e) => {
        clearTimeout(touchStartTimer);

        if (touchDragging) {
            // ドロップ処理
            const touch = e.changedTouches[0];
            const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetItem = targetEl?.closest('.staple-item');

            if (targetItem && targetItem !== touchDraggedEl) {
                const targetIndex = parseInt(targetItem.dataset.index);
                reorderStaples(touchDraggedIndex, targetIndex);
            } else {
                // ドロップ先がなければ元に戻す
                touchDraggedEl?.classList.remove('dragging');
                renderStaplesList();
            }

            // クリーンアップ
            if (touchClone) {
                touchClone.remove();
                touchClone = null;
            }
            touchDragging = false;
            touchDraggedEl = null;
            touchDraggedIndex = null;

            document.querySelectorAll('.staple-item').forEach(item => {
                item.classList.remove('drag-over', 'dragging');
            });

            e.preventDefault();
        }
    });

    itemEl.addEventListener('touchcancel', () => {
        clearTimeout(touchStartTimer);
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }
        touchDragging = false;
        touchDraggedEl?.classList.remove('dragging');
        touchDraggedEl = null;
        touchDraggedIndex = null;
    });
}

function toggleStapleStock(id) {
    const item = staples.items.find(i => i.id === id);
    if (item) {
        item.inStock = !item.inStock;
        saveData(STORAGE_KEYS.STAPLES, staples);
        renderStaplesList();
    }
}

function deleteStaple(id) {
    staples.items = staples.items.filter(i => i.id !== id);
    saveData(STORAGE_KEYS.STAPLES, staples);
    renderStaplesList();
}

function addStaple(name) {
    if (!name.trim()) return;

    staples.items.push({
        id: `staple_${Date.now()}`,
        name: name.trim(),
        inStock: false  // 追加時は「なし」（在庫切れで追加することが多いため）
    });
    saveData(STORAGE_KEYS.STAPLES, staples);
    renderStaplesList();
}

addStapleBtn.addEventListener('click', () => {
    addStaple(newStapleInput.value);
    newStapleInput.value = '';
});

newStapleInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addStaple(newStapleInput.value);
        newStapleInput.value = '';
    }
});

// ========================================
// モーダル共通処理
// ========================================

// 閉じるボタン
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
        if (btn.closest('.modal').id === 'recipe-select-modal') {
            renderCalendar();
        }
    });
});

// 背景クリックで閉じる
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            if (modal.id === 'recipe-select-modal') {
                renderCalendar();
            }
        }
    });
});

// ========================================
// エクスポート・インポート機能
// ========================================

const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importFileInput = document.getElementById('import-file-input');

// データをエクスポート
function exportData() {
    const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        recipes: recipes,
        meals: meals,
        shoppingList: shoppingList,
        staples: staples
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // ファイル名を生成（日付付き）
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const filename = `kyou-nani-backup-${dateStr}.json`;

    // ダウンロードリンクを作成して実行
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('データをエクスポートしました！');
}

// データをインポート
function importData(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // データの検証
            if (!data.recipes || !Array.isArray(data.recipes)) {
                throw new Error('レシピデータが見つかりません');
            }

            // 確認ダイアログ
            const recipeCount = data.recipes.length;
            const mealDays = Object.keys(data.meals || {}).length;
            const message = `以下のデータをインポートします。既存のデータは上書きされます。\n\n` +
                `・レシピ: ${recipeCount}件\n` +
                `・献立登録日数: ${mealDays}日\n` +
                `・買い物リスト: ${(data.shoppingList?.items || []).length}件\n` +
                `・常備品: ${(data.staples?.items || []).length}件\n\n` +
                `インポートを続行しますか？`;

            if (!confirm(message)) {
                return;
            }

            // データを復元
            recipes = data.recipes;
            meals = data.meals || {};
            shoppingList = data.shoppingList || { items: [] };
            staples = data.staples || { items: [] };

            // 保存
            saveData(STORAGE_KEYS.RECIPES, recipes);
            saveData(STORAGE_KEYS.MEALS, meals);
            saveData(STORAGE_KEYS.SHOPPING, shoppingList);
            saveData(STORAGE_KEYS.STAPLES, staples);

            alert('データをインポートしました！');

            // 画面を再描画
            renderCalendar();
            renderRecipesList();
            renderShoppingList();
            renderStaplesList();

        } catch (error) {
            console.error('インポートエラー:', error);
            alert('ファイルの読み込みに失敗しました。正しいバックアップファイルか確認してください。');
        }
    };

    reader.onerror = () => {
        alert('ファイルの読み込みに失敗しました。');
    };

    reader.readAsText(file);
}

// イベントリスナー
exportDataBtn.addEventListener('click', exportData);

importDataBtn.addEventListener('click', () => {
    importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        importData(file);
        // 同じファイルを再度選択できるようにリセット
        importFileInput.value = '';
    }
});

// ========================================
// 初期化
// ========================================

// Service Worker登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// 初期表示
renderCalendar();
