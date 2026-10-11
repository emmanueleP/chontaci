// ==========================================================================
// ContaCarbo - Core Application Controller & State
// Calcolo Carboidrati (CHO) & Bolo Insulina per Diabete
// ==========================================================================

import { FOOD_CATEGORIES, INITIAL_FOODS } from './data/foods.js';
import { searchOffProducts, fetchOffByBarcode } from './data/openfoodfacts.js';

// --- LocalStorage Keys ---
const STORAGE_KEYS = {
  CUSTOM_FOODS: 'contacarbo_custom_foods_v1',
  PLATE: 'contacarbo_current_plate_v1',
  CURRENT_MEAL: 'contacarbo_current_meal_v1',
  FAVORITES: 'contacarbo_favorites_v1',
  HISTORY: 'contacarbo_history_v1',
  FREQUENT_MEALS: 'contacarbo_frequent_meals_v1',
  SETTINGS: 'contacarbo_settings_v1',
  THEME: 'contacarbo_theme_v1'
};

// --- Default Settings ---
const DEFAULT_SETTINGS = {
  enableBolus: true,
  icr: {
    colazione: 10,
    pranzo: 10,
    cena: 10,
    spuntino: 12
  },
  bgTarget: 110,
  isf: 40,
  bolusStep: '0.5'
};

// --- Application State ---
const state = {
  foods: [],
  customFoods: [],
  plate: [],
  currentMeal: 'pranzo',
  currentBg: null,
  activeCategory: 'all',
  searchQuery: '',
  onlyFavorites: false,
  favorites: [],
  history: [],
  frequentMeals: [],
  settings: { ...DEFAULT_SETTINGS },
  selectedFoodForSheet: null,
  theme: 'dark',
  offResults: [],
  offStatus: 'idle' // idle | loading | done | error
};

let offDebounceTimer;
let offAbortController;

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  setupEventListeners();
  renderCategories();
  renderFoodList();
  renderPlate();
  renderHistory();
  renderFrequentMeals();
  applySettingsToUI();
  registerServiceWorker();
});

// Load state from localStorage
function loadStoredData() {
  try {
    // Theme
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    state.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Settings
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
      state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    }

    // Custom Foods
    const savedCustomFoods = localStorage.getItem(STORAGE_KEYS.CUSTOM_FOODS);
    if (savedCustomFoods) {
      state.customFoods = JSON.parse(savedCustomFoods);
    }
    state.foods = [...INITIAL_FOODS, ...state.customFoods];

    // Current Meal
    const savedMeal = localStorage.getItem(STORAGE_KEYS.CURRENT_MEAL);
    if (savedMeal) {
      state.currentMeal = savedMeal;
    }

    // Plate Items
    const savedPlate = localStorage.getItem(STORAGE_KEYS.PLATE);
    if (savedPlate) {
      state.plate = JSON.parse(savedPlate);
    }

    // Favorites
    const savedFavorites = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (savedFavorites) {
      state.favorites = JSON.parse(savedFavorites);
    }

    // History
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (savedHistory) {
      state.history = JSON.parse(savedHistory);
    }

    // Frequent Meals
    const savedFrequent = localStorage.getItem(STORAGE_KEYS.FREQUENT_MEALS);
    if (savedFrequent) {
      state.frequentMeals = JSON.parse(savedFrequent);
    }
  } catch (err) {
    console.error('Errore durante il caricamento dei dati locali:', err);
  }
}

function saveState(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Errore nel salvataggio localStorage:', e);
  }
}

// ==========================================================================
// Service Worker Registration for Offline iOS PWA
// ==========================================================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('Service Worker registrato con successo:', reg.scope))
        .catch((err) => console.warn('Registrazione Service Worker fallita:', err));
    });
  }
}

// ==========================================================================
// UI Calculations (CHO & Insulin Bolus)
// ==========================================================================
function calculateTotals() {
  let totalCarbs = 0;
  let totalSugars = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;

  state.plate.forEach((item) => {
    const factor = item.grams / 100;
    totalCarbs += (item.food.carbsPer100 || 0) * factor;
    totalSugars += (item.food.sugarsPer100 || 0) * factor;
    totalCalories += (item.food.caloriesPer100 || 0) * factor;
    totalProtein += (item.food.proteinPer100 || 0) * factor;
    totalFat += (item.food.fatPer100 || 0) * factor;
  });

  return {
    carbs: Math.round(totalCarbs * 10) / 10,
    sugars: Math.round(totalSugars * 10) / 10,
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein * 10) / 10,
    fat: Math.round(totalFat * 10) / 10
  };
}

function calculateBolus(totalCarbs) {
  if (!state.settings.enableBolus) return { mealBolus: 0, corrBolus: 0, totalBolus: 0 };

  const icr = state.settings.icr[state.currentMeal] || 10;
  const isf = state.settings.isf || 40;
  const targetBg = state.settings.bgTarget || 110;
  const step = parseFloat(state.settings.bolusStep) || 0.5;

  // Bolo Pasto = CHO totali / ICR
  const rawMealBolus = icr > 0 ? totalCarbs / icr : 0;

  // Bolo Correzione = (Glicemia attuale - Target) / ISF
  let rawCorrBolus = 0;
  if (state.currentBg && state.currentBg > 0) {
    rawCorrBolus = (state.currentBg - targetBg) / isf;
  }

  // Somma
  let rawTotal = rawMealBolus + rawCorrBolus;
  if (rawTotal < 0) rawTotal = 0;

  // Arrotondamento al passo configurato (es. 0.5U, 1.0U, 0.1U)
  const roundFactor = 1 / step;
  const roundedTotal = Math.round(rawTotal * roundFactor) / roundFactor;

  return {
    mealBolus: Math.round(rawMealBolus * 10) / 10,
    corrBolus: Math.round(rawCorrBolus * 10) / 10,
    totalBolus: roundedTotal,
    icr,
    targetBg,
    isf
  };
}

// ==========================================================================
// Rendering Functions
// ==========================================================================

// Render Plate Items & Metrics
function renderPlate() {
  const totals = calculateTotals();
  const bolus = calculateBolus(totals.carbs);

  // Update Hero numbers
  document.getElementById('total-carbs-number').textContent = totals.carbs.toFixed(1);
  document.getElementById('macro-sugars').textContent = `${totals.sugars.toFixed(1)} g`;
  document.getElementById('macro-calories').textContent = `${totals.calories} kcal`;
  document.getElementById('macro-proteins').textContent = `${totals.protein.toFixed(1)} g`;
  document.getElementById('macro-fats').textContent = `${totals.fat.toFixed(1)} g`;

  // Item counts & badge
  const countText = `${state.plate.length} ${state.plate.length === 1 ? 'alimento' : 'alimenti'}`;
  document.getElementById('hero-items-count').textContent = countText;
  document.getElementById('plate-items-badge').textContent = state.plate.length;
  document.getElementById('tab-carb-badge').textContent = `${Math.round(totals.carbs)}g`;

  // Update Meal Label
  const mealNames = {
    colazione: 'Colazione',
    pranzo: 'Pranzo',
    cena: 'Cena',
    spuntino: 'Spuntino'
  };
  document.getElementById('current-meal-label').textContent = `${mealNames[state.currentMeal]} • Diabete CHO`;

  // Insulin Bolus Card Updates
  const bolusCard = document.getElementById('bolus-calculator-card');
  if (!state.settings.enableBolus) {
    bolusCard.style.display = 'none';
  } else {
    bolusCard.style.display = 'block';
    document.getElementById('bolus-ratio-hint').textContent = `Rapporto I:C = 1U ogni ${bolus.icr}g CHO`;
    document.getElementById('bolus-meal-units').textContent = `${bolus.mealBolus.toFixed(1)} U`;
    
    const sign = bolus.corrBolus >= 0 ? '+' : '';
    document.getElementById('bolus-corr-units').textContent = `${sign}${bolus.corrBolus.toFixed(1)} U`;
    document.getElementById('bolus-total-units').textContent = bolus.totalBolus.toFixed(1);

    // Formula details
    document.getElementById('formula-meal-text').textContent = 
      `Pasto: ${totals.carbs.toFixed(1)}g CHO ÷ ${bolus.icr} = ${bolus.mealBolus.toFixed(1)} U`;
    
    if (state.currentBg) {
      document.getElementById('formula-corr-text').textContent = 
        `Correzione: (${state.currentBg} - ${bolus.targetBg} target) ÷ ${bolus.isf} ISF = ${sign}${bolus.corrBolus.toFixed(1)} U`;
    } else {
      document.getElementById('formula-corr-text').textContent = 
        `Nessuna correzione (glicemia attuale non inserita)`;
    }

    updateBgStatusIndicator();
  }

  // Plate Items List
  const listEl = document.getElementById('plate-items-list');
  const emptyState = document.getElementById('plate-empty-state');
  const clearBtn = document.getElementById('clear-plate-btn');
  const footerActions = document.getElementById('plate-footer-actions');

  listEl.innerHTML = '';

  if (state.plate.length === 0) {
    emptyState.style.display = 'flex';
    clearBtn.style.display = 'none';
    footerActions.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    clearBtn.style.display = 'block';
    footerActions.style.display = 'flex';

    state.plate.forEach((item, index) => {
      const itemCho = Math.round((item.food.carbsPer100 * (item.grams / 100)) * 10) / 10;
      
      const li = document.createElement('li');
      li.className = 'plate-item-card';
      li.innerHTML = `
        <div class="plate-item-info">
          <span class="plate-item-icon">${item.food.icon || '🍽️'}</span>
          <div class="plate-item-text">
            <span class="plate-item-name">${escapeHtml(item.food.name)}</span>
            <span class="plate-item-sub">${item.food.carbsPer100}g CHO/100g</span>
          </div>
        </div>
        <div class="plate-item-right">
          <div class="plate-grams-control">
            <button type="button" class="qty-mini-btn btn-plate-minus" data-index="${index}" aria-label="Diminuisci 10g">-</button>
            <span class="qty-display-grams">${item.grams}g</span>
            <button type="button" class="qty-mini-btn btn-plate-plus" data-index="${index}" aria-label="Aumenta 10g">+</button>
          </div>
          <div class="plate-cho-badge">
            <span class="plate-cho-value">${itemCho.toFixed(1)}</span>
            <span class="plate-cho-unit">g CHO</span>
          </div>
          <button type="button" class="delete-plate-item-btn" data-index="${index}" title="Rimuovi dal piatto" aria-label="Elimina alimento">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  // Save plate state
  saveState(STORAGE_KEYS.PLATE, state.plate);
}

// BG status badge indicator styling
function updateBgStatusIndicator() {
  const badge = document.getElementById('bg-status-indicator');
  const text = document.getElementById('bg-status-text');

  badge.className = 'bg-status-badge';

  if (!state.currentBg || state.currentBg <= 0) {
    text.textContent = 'Glicemia opzionale';
    return;
  }

  const bg = state.currentBg;
  if (bg < 70) {
    badge.classList.add('bg-low');
    text.textContent = '⚠️ IPOGLICEMIA (<70)';
  } else if (bg <= 140) {
    badge.classList.add('bg-normal');
    text.textContent = 'In Target (70-140)';
  } else if (bg <= 180) {
    badge.classList.add('bg-elevated');
    text.textContent = 'Moderata (140-180)';
  } else {
    badge.classList.add('bg-high');
    text.textContent = 'Alta (>180)';
  }
}

// Render Categories
function renderCategories() {
  const container = document.getElementById('category-pills-list');
  container.innerHTML = '';

  FOOD_CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cat-pill ${state.activeCategory === cat.id ? 'active' : ''}`;
    btn.dataset.category = cat.id;
    btn.innerHTML = `<span>${cat.icon}</span> ${cat.name}`;
    btn.addEventListener('click', () => {
      state.activeCategory = cat.id;
      scheduleOffSearch();
      renderCategories();
      renderFoodList();
    });
    container.appendChild(btn);
  });
}

// Render Food Database Cards
function renderFoodList() {
  const container = document.getElementById('food-cards-container');
  const query = state.searchQuery.toLowerCase().trim();

  let filtered = state.foods.filter((food) => {
    // Category match
    if (state.activeCategory !== 'all' && food.category !== state.activeCategory) {
      return false;
    }
    // Favorites filter
    if (state.onlyFavorites && !state.favorites.includes(food.id)) {
      return false;
    }
    // Search query match
    if (query) {
      return food.name.toLowerCase().includes(query);
    }
    return true;
  });

  // Sort: favorites first, then alphabetically
  filtered.sort((a, b) => {
    const aFav = state.favorites.includes(a.id) ? 1 : 0;
    const bFav = state.favorites.includes(b.id) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return a.name.localeCompare(b.name, 'it');
  });

  document.getElementById('db-filtered-count').textContent = 
    `Trovati ${filtered.length} alimenti`;

  container.innerHTML = '';

  const offActive = shouldUseOff(query);

  if (filtered.length === 0 && !offActive) {
    container.innerHTML = `
      <div class="empty-state-card" style="padding: 24px;">
        <div class="empty-icon-circle">🔍</div>
        <h3 class="empty-title">Nessun alimento trovato</h3>
        <p class="empty-desc">Prova un altro termine o crea un alimento personalizzato con il tasto "+ Nuovo".</p>
      </div>
    `;
    return;
  }

  filtered.forEach((food) => container.appendChild(buildFoodCard(food)));

  if (offActive) renderOffSection(container);
}

// Open Food Facts viene interrogato solo con una ricerca testuale nella categoria "Tutti"
function shouldUseOff(query) {
  return !state.onlyFavorites && state.activeCategory === 'all' && query.length >= 2;
}

function renderOffSection(container) {
  const section = document.createElement('div');
  section.className = 'off-section';
  section.style.cssText = 'margin-top:16px;';

  const knownIds = new Set(state.foods.map((f) => f.id));
  const results = state.offResults.filter((f) => !knownIds.has(f.id));

  let statusHtml = '';
  if (state.offStatus === 'loading') {
    statusHtml = 'Ricerca su Open Food Facts…';
  } else if (state.offStatus === 'error') {
    statusHtml = 'Open Food Facts non raggiungibile (sei offline?)';
  } else if (results.length === 0) {
    statusHtml = 'Nessun prodotto trovato su Open Food Facts';
  } else {
    statusHtml = `${results.length} prodotti da Open Food Facts · verifica sempre i valori sull'etichetta`;
  }

  const header = document.createElement('p');
  header.className = 'food-portion-hint';
  header.style.cssText = 'margin:0 0 8px;padding:0 4px;';
  header.textContent = `🌍 ${statusHtml}`;
  section.appendChild(header);

  if (state.offStatus !== 'loading') {
    results.forEach((food) => section.appendChild(buildFoodCard(food)));
  }
  container.appendChild(section);
}

// Ricerca live con debounce (evita di superare i limiti di richieste dell'API)
function scheduleOffSearch() {
  clearTimeout(offDebounceTimer);
  if (offAbortController) offAbortController.abort();

  const query = state.searchQuery.trim();
  if (!shouldUseOff(query.toLowerCase())) {
    state.offResults = [];
    state.offStatus = 'idle';
    return;
  }

  state.offStatus = 'loading';
  offDebounceTimer = setTimeout(async () => {
    offAbortController = new AbortController();
    const { signal } = offAbortController;
    try {
      if (/^\d{8,14}$/.test(query)) {
        const product = await fetchOffByBarcode(query, { signal });
        state.offResults = product ? [product] : [];
      } else {
        state.offResults = await searchOffProducts(query, { signal });
      }
      state.offStatus = 'done';
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Open Food Facts:', err);
      state.offResults = [];
      state.offStatus = 'error';
    }
    renderFoodList();
  }, 500);
}

function buildFoodCard(food) {
  {
    const isFav = state.favorites.includes(food.id);
    const card = document.createElement('div');
    card.className = 'food-card';
    card.dataset.id = food.id;

    card.innerHTML = `
      <div class="food-card-left">
        <div class="food-icon-box">${food.icon || '🍽️'}</div>
        <div class="food-meta-info">
          <div class="food-title-row">
            <span class="food-name">${escapeHtml(food.name)}</span>
          </div>
          <span class="food-portion-hint">${escapeHtml(food.portionLabel || `${food.defaultPortion || 100}g porzione`)}</span>
        </div>
      </div>
      <div class="food-card-right">
        <div class="food-stats-block">
          <span class="food-carbs-val">${food.carbsPer100}g</span>
          <span class="food-carbs-sub">per 100g</span>
        </div>
        <button type="button" class="food-fav-toggle-btn ${isFav ? 'is-favorite' : ''}" data-id="${food.id}" title="${isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}" aria-label="Preferito">
          ★
        </button>
      </div>
    `;

    // Tap card to open portion bottom sheet
    card.addEventListener('click', (e) => {
      if (e.target.closest('.food-fav-toggle-btn')) return;
      openPortionSheet(food);
    });

    // Favorite star button
    const favBtn = card.querySelector('.food-fav-toggle-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(food.id);
    });

    return card;
  }
}

// Toggle Favorite Food
function toggleFavorite(foodId) {
  const index = state.favorites.indexOf(foodId);
  if (index > -1) {
    state.favorites.splice(index, 1);
    showToast('Rimosso dai preferiti');
  } else {
    state.favorites.push(foodId);
    showToast('Aggiunto ai preferiti ⭐');
  }
  saveState(STORAGE_KEYS.FAVORITES, state.favorites);
  renderFoodList();
}

// ==========================================================================
// Bottom Sheet: Food Portion Selector
// ==========================================================================
function openPortionSheet(food) {
  state.selectedFoodForSheet = food;
  const overlay = document.getElementById('portion-sheet-overlay');

  document.getElementById('sheet-food-icon').textContent = food.icon || '🍽️';
  document.getElementById('sheet-food-name').textContent = food.name;
  document.getElementById('sheet-food-carbs-100').textContent = `${food.carbsPer100} g CHO per 100g`;

  // Default grams to typical portion or 100g
  const initialGrams = food.defaultPortion || 100;
  const inputGrams = document.getElementById('portion-grams-input');
  inputGrams.value = initialGrams;

  // Setup presets labels
  const typicalBtn = document.getElementById('preset-portion-typical');
  typicalBtn.textContent = `Standard (${initialGrams}g)`;
  typicalBtn.dataset.grams = initialGrams;

  document.getElementById('preset-portion-half').dataset.grams = Math.round(initialGrams / 2);
  document.getElementById('preset-portion-half').textContent = `1/2 (${Math.round(initialGrams / 2)}g)`;

  document.getElementById('preset-portion-double').dataset.grams = initialGrams * 2;
  document.getElementById('preset-portion-double').textContent = `Doppia (${initialGrams * 2}g)`;

  document.getElementById('preset-portion-100g').dataset.grams = 100;

  updatePortionSheetCalculations(initialGrams);
  overlay.classList.add('active');
}

function updatePortionSheetCalculations(grams) {
  if (!state.selectedFoodForSheet) return;
  const food = state.selectedFoodForSheet;
  const cho = Math.round((food.carbsPer100 * (grams / 100)) * 10) / 10;
  const cal = Math.round((food.caloriesPer100 || 0) * (grams / 100));

  document.getElementById('sheet-calculated-cho').textContent = `${cho.toFixed(1)} g CHO`;
  document.getElementById('sheet-calculated-calories').textContent = `${cal} kcal`;
}

function closePortionSheet() {
  document.getElementById('portion-sheet-overlay').classList.remove('active');
  state.selectedFoodForSheet = null;
}

// ==========================================================================
// History & Frequent Meals
// ==========================================================================
function logCurrentMeal() {
  if (state.plate.length === 0) {
    showToast('Aggiungi prima degli alimenti al piatto!');
    return;
  }

  const totals = calculateTotals();
  const bolus = calculateBolus(totals.carbs);

  const entry = {
    id: 'log_' + Date.now(),
    date: new Date().toISOString(),
    mealType: state.currentMeal,
    items: state.plate.map(item => ({
      name: item.food.name,
      grams: item.grams,
      carbs: Math.round((item.food.carbsPer100 * (item.grams / 100)) * 10) / 10
    })),
    rawItems: [...state.plate],
    totalCarbs: totals.carbs,
    totalCalories: totals.calories,
    bg: state.currentBg,
    bolusUnits: bolus.totalBolus
  };

  state.history.unshift(entry);
  if (state.history.length > 50) state.history.pop(); // keep last 50
  saveState(STORAGE_KEYS.HISTORY, state.history);

  renderHistory();
  showToast('Pasto registrato nel diario! 📖');
}

function renderHistory() {
  const container = document.getElementById('history-items-list');
  const clearBtn = document.getElementById('clear-history-btn');

  container.innerHTML = '';

  if (state.history.length === 0) {
    clearBtn.style.display = 'none';
    container.innerHTML = `
      <div class="empty-state-card" style="padding: 24px;">
        <div class="empty-icon-circle">📖</div>
        <h3 class="empty-title">Nessun pasto registrato</h3>
        <p class="empty-desc">I pasti salvati nel diario compariranno qui con il riepilogo dei carboidrati e dell'insulina.</p>
      </div>
    `;
    return;
  }

  clearBtn.style.display = 'block';

  state.history.forEach((entry, idx) => {
    const d = new Date(entry.date);
    const timeFormatted = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

    const mealNames = {
      colazione: '☕ Colazione',
      pranzo: '🍝 Pranzo',
      cena: '🍲 Cena',
      spuntino: '🍏 Spuntino'
    };

    const itemsSummary = entry.items.map(i => `${i.name} (${i.grams}g)`).join(', ');

    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-card-header">
        <span class="history-meal-type">${mealNames[entry.mealType] || 'Pasto'}</span>
        <span class="history-timestamp">${dateFormatted} alle ${timeFormatted}</span>
      </div>
      <p class="history-items-summary">${escapeHtml(itemsSummary)}</p>
      <div class="history-stats-bar">
        <span class="history-cho-pill">${entry.totalCarbs} g CHO</span>
        ${entry.bolusUnits > 0 ? `<span class="history-bolus-pill">Bolo: ${entry.bolusUnits} U</span>` : ''}
        <div class="card-action-btns">
          <button type="button" class="btn-card-action load" data-history-idx="${idx}">Ricarica</button>
          <button type="button" class="btn-card-action delete-hist-btn" data-history-idx="${idx}">✕</button>
        </div>
      </div>
    `;

    card.querySelector('.btn-card-action.load').addEventListener('click', () => {
      if (entry.rawItems && entry.rawItems.length > 0) {
        state.plate = JSON.parse(JSON.stringify(entry.rawItems));
        state.currentMeal = entry.mealType;
        updateActiveMealPill();
        renderPlate();
        switchToTab('tab-calculator');
        showToast('Pasto ricaricato nel piatto!');
      }
    });

    card.querySelector('.delete-hist-btn').addEventListener('click', () => {
      state.history.splice(idx, 1);
      saveState(STORAGE_KEYS.HISTORY, state.history);
      renderHistory();
      showToast('Voce rimossa');
    });

    container.appendChild(card);
  });
}

function saveAsFrequentMeal() {
  if (state.plate.length === 0) {
    showToast('Il piatto è vuoto!');
    return;
  }

  const mealName = prompt('Inserisci un nome per questo pasto frequente:', 
    `${state.plate[0].food.name} e altro`);

  if (!mealName || !mealName.trim()) return;

  const totals = calculateTotals();
  const frequentEntry = {
    id: 'freq_' + Date.now(),
    name: mealName.trim(),
    items: JSON.parse(JSON.stringify(state.plate)),
    totalCarbs: totals.carbs
  };

  state.frequentMeals.push(frequentEntry);
  saveState(STORAGE_KEYS.FREQUENT_MEALS, state.frequentMeals);
  renderFrequentMeals();
  showToast('Pasto frequente salvato! ⭐');
}

function renderFrequentMeals() {
  const container = document.getElementById('frequent-items-list');
  container.innerHTML = '';

  if (state.frequentMeals.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="padding: 24px;">
        <div class="empty-icon-circle">⭐</div>
        <h3 class="empty-title">Nessun pasto frequente</h3>
        <p class="empty-desc">Componi un piatto e tocca "Salva come Pasto Frequente" per richiamarlo velocemente in futuro.</p>
      </div>
    `;
    return;
  }

  state.frequentMeals.forEach((freq, idx) => {
    const card = document.createElement('div');
    card.className = 'frequent-card';

    const itemsSummary = freq.items.map(i => `${i.food.name} (${i.grams}g)`).join(' + ');

    card.innerHTML = `
      <div class="frequent-card-header">
        <h3 class="history-meal-type">${escapeHtml(freq.name)}</h3>
        <span class="history-cho-pill">${freq.totalCarbs} g CHO</span>
      </div>
      <p class="history-items-summary">${escapeHtml(itemsSummary)}</p>
      <div class="card-action-btns" style="justify-content: flex-end; margin-top: 8px;">
        <button type="button" class="btn-card-action load" data-freq-idx="${idx}">Carica nel Piatto</button>
        <button type="button" class="btn-card-action delete-freq-btn" data-freq-idx="${idx}">Elimina</button>
      </div>
    `;

    card.querySelector('.btn-card-action.load').addEventListener('click', () => {
      state.plate = JSON.parse(JSON.stringify(freq.items));
      renderPlate();
      switchToTab('tab-calculator');
      showToast(`Pasto "${freq.name}" caricato!`);
    });

    card.querySelector('.delete-freq-btn').addEventListener('click', () => {
      state.frequentMeals.splice(idx, 1);
      saveState(STORAGE_KEYS.FREQUENT_MEALS, state.frequentMeals);
      renderFrequentMeals();
      showToast('Pasto frequente eliminato');
    });

    container.appendChild(card);
  });
}

// ==========================================================================
// Settings, Theme & Tabs
// ==========================================================================
function applySettingsToUI() {
  document.getElementById('setting-enable-bolus').checked = state.settings.enableBolus;
  document.getElementById('setting-icr-colazione').value = state.settings.icr.colazione;
  document.getElementById('setting-icr-pranzo').value = state.settings.icr.pranzo;
  document.getElementById('setting-icr-cena').value = state.settings.icr.cena;
  document.getElementById('setting-icr-spuntino').value = state.settings.icr.spuntino;
  document.getElementById('setting-bg-target').value = state.settings.bgTarget;
  document.getElementById('setting-isf').value = state.settings.isf;
  document.getElementById('setting-bolus-step').value = state.settings.bolusStep;
  document.getElementById('bolus-parameters-group').style.display = 
    state.settings.enableBolus ? 'block' : 'none';
}

function saveSettingsFromUI() {
  state.settings.enableBolus = document.getElementById('setting-enable-bolus').checked;
  state.settings.icr.colazione = parseFloat(document.getElementById('setting-icr-colazione').value) || 10;
  state.settings.icr.pranzo = parseFloat(document.getElementById('setting-icr-pranzo').value) || 10;
  state.settings.icr.cena = parseFloat(document.getElementById('setting-icr-cena').value) || 10;
  state.settings.icr.spuntino = parseFloat(document.getElementById('setting-icr-spuntino').value) || 12;
  state.settings.bgTarget = parseInt(document.getElementById('setting-bg-target').value, 10) || 110;
  state.settings.isf = parseInt(document.getElementById('setting-isf').value, 10) || 40;
  state.settings.bolusStep = document.getElementById('setting-bolus-step').value;

  document.getElementById('bolus-parameters-group').style.display = 
    state.settings.enableBolus ? 'block' : 'none';

  saveState(STORAGE_KEYS.SETTINGS, state.settings);
  renderPlate();
}

function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  state.theme = newTheme;
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  showToast(`Tema ${newTheme === 'dark' ? 'Scuro' : 'Chiaro'} attivato`);
}

function switchToTab(tabId) {
  // Update view classes
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active-view'));
  const targetView = document.getElementById(tabId);
  if (targetView) targetView.classList.add('active-view');

  // Update nav buttons
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Scroll to top of content
  document.getElementById('main-content-scroll').scrollTo({ top: 0, behavior: 'smooth' });
}

function updateActiveMealPill() {
  document.querySelectorAll('.meal-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.meal === state.currentMeal);
  });
}

// Toast notification helper
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================================================
// Backup Export & Import (JSON)
// ==========================================================================
function exportUserData() {
  const exportPayload = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    customFoods: state.customFoods,
    favorites: state.favorites,
    history: state.history,
    frequentMeals: state.frequentMeals,
    settings: state.settings,
    plate: state.plate
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  const dateStr = new Date().toISOString().split('T')[0];
  dlAnchor.setAttribute('download', `contacarbo_backup_${dateStr}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();

  showToast('File backup esportato!');
}

function importUserData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.customFoods) {
        state.customFoods = data.customFoods;
        state.foods = [...INITIAL_FOODS, ...state.customFoods];
        saveState(STORAGE_KEYS.CUSTOM_FOODS, state.customFoods);
      }
      if (data.favorites) {
        state.favorites = data.favorites;
        saveState(STORAGE_KEYS.FAVORITES, state.favorites);
      }
      if (data.history) {
        state.history = data.history;
        saveState(STORAGE_KEYS.HISTORY, state.history);
      }
      if (data.frequentMeals) {
        state.frequentMeals = data.frequentMeals;
        saveState(STORAGE_KEYS.FREQUENT_MEALS, state.frequentMeals);
      }
      if (data.settings) {
        state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
        saveState(STORAGE_KEYS.SETTINGS, state.settings);
        applySettingsToUI();
      }
      if (data.plate) {
        state.plate = data.plate;
        saveState(STORAGE_KEYS.PLATE, state.plate);
      }

      renderFoodList();
      renderPlate();
      renderHistory();
      renderFrequentMeals();
      showToast('Dati importati con successo! ✅');
    } catch (err) {
      alert('File di backup non valido o danneggiato.');
    }
  };
  reader.readAsText(file);
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners() {
  // Navigation tabs
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => switchToTab(btn.dataset.tab));
  });

  // Theme toggle
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

  // iPhone guide modal
  const guideOverlay = document.getElementById('iphone-guide-overlay');
  document.getElementById('install-guide-btn').addEventListener('click', () => guideOverlay.classList.add('active'));
  document.getElementById('btn-see-iphone-instructions').addEventListener('click', () => guideOverlay.classList.add('active'));
  document.getElementById('close-guide-btn').addEventListener('click', () => guideOverlay.classList.remove('active'));
  document.getElementById('close-guide-btn-action').addEventListener('click', () => guideOverlay.classList.remove('active'));

  // Meal pills (Colazione, Pranzo, Cena, Spuntino)
  document.querySelectorAll('.meal-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentMeal = btn.dataset.meal;
      localStorage.setItem(STORAGE_KEYS.CURRENT_MEAL, state.currentMeal);
      updateActiveMealPill();
      renderPlate();
    });
  });

  // Current Blood Glucose input
  const bgInput = document.getElementById('current-bg-input');
  bgInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.currentBg = !isNaN(val) && val > 0 ? val : null;
    renderPlate();
  });

  // Toggle bolus details collapsible
  document.getElementById('toggle-bolus-details-btn').addEventListener('click', () => {
    const details = document.getElementById('bolus-formula-details');
    const isHidden = details.style.display === 'none';
    details.style.display = isHidden ? 'block' : 'none';
    document.getElementById('toggle-bolus-details-btn').textContent = isHidden ? 'Nascondi' : 'Dettagli';
  });

  // Clear plate
  document.getElementById('clear-plate-btn').addEventListener('click', () => {
    if (confirm('Vuoi svuotare tutti gli alimenti dal piatto?')) {
      state.plate = [];
      renderPlate();
      showToast('Piatto svuotato');
    }
  });

  // Open food db from plate
  document.getElementById('open-add-food-btn').addEventListener('click', () => switchToTab('tab-database'));
  document.getElementById('empty-add-first-food-btn').addEventListener('click', () => switchToTab('tab-database'));

  // Log meal & Save frequent
  document.getElementById('log-meal-btn').addEventListener('click', logCurrentMeal);
  document.getElementById('save-as-frequent-btn').addEventListener('click', saveAsFrequentMeal);

  // Plate list delegation for quantity steppers & deletion
  const plateList = document.getElementById('plate-items-list');
  plateList.addEventListener('click', (e) => {
    const minusBtn = e.target.closest('.btn-plate-minus');
    const plusBtn = e.target.closest('.btn-plate-plus');
    const delBtn = e.target.closest('.delete-plate-item-btn');

    if (minusBtn) {
      const idx = parseInt(minusBtn.dataset.index, 10);
      if (state.plate[idx]) {
        state.plate[idx].grams = Math.max(5, state.plate[idx].grams - 10);
        renderPlate();
      }
    } else if (plusBtn) {
      const idx = parseInt(plusBtn.dataset.index, 10);
      if (state.plate[idx]) {
        state.plate[idx].grams += 10;
        renderPlate();
      }
    } else if (delBtn) {
      const idx = parseInt(delBtn.dataset.index, 10);
      if (state.plate[idx]) {
        state.plate.splice(idx, 1);
        renderPlate();
        showToast('Alimento rimosso');
      }
    }
  });

  // Food Search Input
  const searchInput = document.getElementById('food-search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearSearchBtn.style.display = state.searchQuery ? 'flex' : 'none';
    scheduleOffSearch();
    renderFoodList();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    scheduleOffSearch();
    renderFoodList();
  });

  // Favorites only toggle
  const favFilterBtn = document.getElementById('fav-only-filter-btn');
  favFilterBtn.addEventListener('click', () => {
    state.onlyFavorites = !state.onlyFavorites;
    favFilterBtn.classList.toggle('active', state.onlyFavorites);
    scheduleOffSearch();
    renderFoodList();
  });

  // Portion Bottom Sheet Events
  const portionInput = document.getElementById('portion-grams-input');
  portionInput.addEventListener('input', (e) => {
    const grams = Math.max(1, parseInt(e.target.value, 10) || 1);
    updatePortionSheetCalculations(grams);
  });

  document.getElementById('step-minus-10').addEventListener('click', () => {
    let g = Math.max(5, (parseInt(portionInput.value, 10) || 100) - 10);
    portionInput.value = g;
    updatePortionSheetCalculations(g);
  });
  document.getElementById('step-minus-1').addEventListener('click', () => {
    let g = Math.max(1, (parseInt(portionInput.value, 10) || 100) - 1);
    portionInput.value = g;
    updatePortionSheetCalculations(g);
  });
  document.getElementById('step-plus-1').addEventListener('click', () => {
    let g = (parseInt(portionInput.value, 10) || 100) + 1;
    portionInput.value = g;
    updatePortionSheetCalculations(g);
  });
  document.getElementById('step-plus-10').addEventListener('click', () => {
    let g = (parseInt(portionInput.value, 10) || 100) + 10;
    portionInput.value = g;
    updatePortionSheetCalculations(g);
  });

  // Preset Chips
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const g = parseInt(chip.dataset.grams, 10) || 100;
      portionInput.value = g;
      updatePortionSheetCalculations(g);
    });
  });

  // Close Portion Sheet
  document.getElementById('close-portion-sheet-btn').addEventListener('click', closePortionSheet);
  document.getElementById('portion-sheet-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'portion-sheet-overlay') closePortionSheet();
  });

  // Confirm Add Food to Plate
  document.getElementById('confirm-add-food-btn').addEventListener('click', () => {
    if (!state.selectedFoodForSheet) return;
    const food = state.selectedFoodForSheet;
    const grams = Math.max(1, parseInt(portionInput.value, 10) || 100);

    // Prodotti Open Food Facts: salvati in locale per usarli anche offline
    if (food.source === 'openfoodfacts' && !state.foods.some((f) => f.id === food.id)) {
      state.customFoods.push(food);
      state.foods.unshift(food);
      saveState(STORAGE_KEYS.CUSTOM_FOODS, state.customFoods);
    }

    // Check if food already in plate -> update grams or add new
    const existingIndex = state.plate.findIndex(item => item.food.id === food.id);
    if (existingIndex > -1) {
      state.plate[existingIndex].grams += grams;
    } else {
      state.plate.push({ food, grams });
    }

    closePortionSheet();
    renderPlate();
    switchToTab('tab-calculator');
    showToast(`Aggiunto: ${food.name} (${grams}g) ✅`);
  });

  // Custom Food Modal
  const customModal = document.getElementById('custom-food-modal-overlay');
  document.getElementById('open-custom-food-modal-btn').addEventListener('click', () => customModal.classList.add('active'));
  document.getElementById('close-custom-modal-btn').addEventListener('click', () => customModal.classList.remove('active'));
  document.getElementById('cancel-custom-food-btn').addEventListener('click', () => customModal.classList.remove('active'));

  // Custom Food Form Submit
  document.getElementById('custom-food-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('custom-name').value.trim();
    const carbs = parseFloat(document.getElementById('custom-carbs').value);
    const portion = parseInt(document.getElementById('custom-portion').value, 10) || 100;
    const category = document.getElementById('custom-category').value;
    const calories = parseInt(document.getElementById('custom-calories').value, 10) || Math.round(carbs * 4);
    const sugars = parseFloat(document.getElementById('custom-sugars').value) || 0;
    const protein = parseFloat(document.getElementById('custom-protein').value) || 0;
    const fat = parseFloat(document.getElementById('custom-fat').value) || 0;

    if (!name || isNaN(carbs)) return;

    const newFood = {
      id: 'custom_' + Date.now(),
      name,
      category,
      icon: '✨',
      carbsPer100: Math.round(carbs * 10) / 10,
      sugarsPer100: sugars,
      caloriesPer100: calories,
      proteinPer100: protein,
      fatPer100: fat,
      defaultPortion: portion,
      portionLabel: `1 porzione (${portion}g)`,
      gi: 'medio'
    };

    state.customFoods.push(newFood);
    state.foods.unshift(newFood);
    saveState(STORAGE_KEYS.CUSTOM_FOODS, state.customFoods);

    e.target.reset();
    customModal.classList.remove('active');
    renderFoodList();
    showToast(`Alimento "${name}" creato!`);
  });

  // Subtab navigation in Diario (Cronologia vs Preferiti)
  const historyBtn = document.getElementById('subtab-history-btn');
  const frequentBtn = document.getElementById('subtab-frequent-btn');
  const historyPanel = document.getElementById('panel-history');
  const frequentPanel = document.getElementById('panel-frequent');

  historyBtn.addEventListener('click', () => {
    historyBtn.classList.add('active');
    frequentBtn.classList.remove('active');
    historyPanel.classList.add('active');
    frequentPanel.classList.remove('active');
  });

  frequentBtn.addEventListener('click', () => {
    frequentBtn.classList.add('active');
    historyBtn.classList.remove('active');
    frequentPanel.classList.add('active');
    historyPanel.classList.remove('active');
  });

  // Clear History
  document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (confirm('Vuoi cancellare tutta la cronologia pasti?')) {
      state.history = [];
      saveState(STORAGE_KEYS.HISTORY, state.history);
      renderHistory();
      showToast('Cronologia cancellata');
    }
  });

  // Settings inputs changes
  document.getElementById('setting-enable-bolus').addEventListener('change', saveSettingsFromUI);
  document.getElementById('setting-icr-colazione').addEventListener('change', saveSettingsFromUI);
  document.getElementById('setting-icr-pranzo').addEventListener('change', saveSettingsFromUI);
  document.getElementById('setting-icr-cena').addEventListener('change', saveSettingsFromUI);
  document.getElementById('setting-icr-spuntino').addEventListener('change', saveSettingsFromUI);
  document.getElementById('setting-bg-target').addEventListener('change', saveSettingsFromUI);
  document.getElementById('setting-isf').addEventListener('change', saveSettingsFromUI);
  document.getElementById('setting-bolus-step').addEventListener('change', saveSettingsFromUI);

  // Backup & Restore
  document.getElementById('export-data-btn').addEventListener('click', exportUserData);
  const importFileInput = document.getElementById('import-file-input');
  document.getElementById('import-data-btn').addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importUserData);

  // Reset defaults
  document.getElementById('reset-defaults-btn').addEventListener('click', () => {
    if (confirm('Attenzione: vuoi ripristinare tutte le impostazioni e cancellare gli alimenti personalizzati?')) {
      localStorage.clear();
      window.location.reload();
    }
  });
}
