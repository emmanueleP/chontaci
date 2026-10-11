// ==========================================================================
// Open Food Facts - client API
// Dati: https://world.openfoodfacts.org (licenza ODbL, © contributori Open Food Facts)
// ==========================================================================

const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'code,product_name,generic_name,brands,nutriments,serving_quantity,serving_size';

// Converte un prodotto OFF nel formato interno di ContaCarbo.
// Restituisce null se mancano i carboidrati (dato indispensabile per il calcolo del bolo).
export function mapOffProduct(p) {
  if (!p || !p.code) return null;
  const n = p.nutriments || {};
  const carbs = Number(n.carbohydrates_100g);
  if (!Number.isFinite(carbs) || carbs < 0 || carbs > 100) return null;

  const baseName = (p.product_name || p.generic_name || '').trim();
  if (!baseName) return null;
  const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands || '').split(',')[0];
  const brandTrim = (brand || '').trim();
  const name = brandTrim && !baseName.toLowerCase().includes(brandTrim.toLowerCase())
    ? `${baseName} - ${brandTrim}`
    : baseName;

  const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
  const serving = Math.round(Number(p.serving_quantity));
  const hasServing = Number.isFinite(serving) && serving > 0 && serving <= 1000;

  const kcal = Number(n['energy-kcal_100g']);

  return {
    id: 'off_' + p.code,
    name,
    category: 'altro',
    icon: '🏷️',
    source: 'openfoodfacts',
    barcode: p.code,
    carbsPer100: round1(carbs),
    sugarsPer100: round1(n.sugars_100g),
    fiberPer100: round1(n.fiber_100g),
    caloriesPer100: Number.isFinite(kcal) ? Math.round(kcal) : Math.round(carbs * 4),
    proteinPer100: round1(n.proteins_100g),
    fatPer100: round1(n.fat_100g),
    defaultPortion: hasServing ? serving : 100,
    portionLabel: hasServing ? `1 porzione (${serving}g)` : '100g',
    gi: 'medio'
  };
}

// Cerca prodotti per nome (solo Italia, solo con carboidrati dichiarati).
export async function searchOffProducts(query, { signal, pageSize = 20 } = {}) {
  const safe = query.replace(/["\\:()]/g, ' ').trim();
  if (safe.length < 2) return [];

  const params = new URLSearchParams({
    q: `countries_tags:"en:italy" AND nutriments.carbohydrates_100g:* AND (${safe})`,
    page_size: String(pageSize),
    langs: 'it,en',
    fields: FIELDS
  });

  const res = await fetch(`${SEARCH_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Open Food Facts HTTP ${res.status}`);
  const data = await res.json();
  return (data.hits || []).map(mapOffProduct).filter(Boolean);
}

// Cerca un prodotto tramite codice a barre (EAN-8/12/13/14).
export async function fetchOffByBarcode(barcode, { signal } = {}) {
  const res = await fetch(`${PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1) return null;
  return mapOffProduct(data.product);
}
