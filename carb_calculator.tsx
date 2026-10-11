/**
 * ContaCarbo - Componente React / TypeScript (carb_calculator.tsx)
 * Calcolo Carboidrati (CHO) e Bolo Insulina per Diabete
 *
 * Questa versione TSX è pronta per essere inclusa in progetti React, Next.js o Vite.
 * La versione HTML/CSS/JS standalone è già pronta nella root del progetto per GitHub Pages.
 */

import React, { useState, useMemo, useEffect } from 'react';

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  icon?: string;
  carbsPer100: number;
  sugarsPer100?: number;
  caloriesPer100?: number;
  proteinPer100?: number;
  fatPer100?: number;
  defaultPortion?: number;
  portionLabel?: string;
  gi?: 'basso' | 'medio' | 'alto';
}

export interface PlateEntry {
  food: FoodItem;
  grams: number;
}

export interface BolusSettings {
  enableBolus: boolean;
  icr: {
    colazione: number;
    pranzo: number;
    cena: number;
    spuntino: number;
  };
  bgTarget: number;
  isf: number;
  bolusStep: number;
}

export type MealType = 'colazione' | 'pranzo' | 'cena' | 'spuntino';

export const CarbCalculator: React.FC = () => {
  const [mealType, setMealType] = useState<MealType>('pranzo');
  const [plate, setPlate] = useState<PlateEntry[]>([]);
  const [currentBg, setCurrentBg] = useState<number | ''>('');
  const [settings, setSettings] = useState<BolusSettings>({
    enableBolus: true,
    icr: { colazione: 10, pranzo: 10, cena: 10, spuntino: 12 },
    bgTarget: 110,
    isf: 40,
    bolusStep: 0.5
  });

  // Calcoli Pasto
  const totals = useMemo(() => {
    let carbs = 0;
    let sugars = 0;
    let calories = 0;
    let protein = 0;
    let fat = 0;

    for (const item of plate) {
      const factor = item.grams / 100;
      carbs += item.food.carbsPer100 * factor;
      sugars += (item.food.sugarsPer100 || 0) * factor;
      calories += (item.food.caloriesPer100 || 0) * factor;
      protein += (item.food.proteinPer100 || 0) * factor;
      fat += (item.food.fatPer100 || 0) * factor;
    }

    return {
      carbs: Math.round(carbs * 10) / 10,
      sugars: Math.round(sugars * 10) / 10,
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      fat: Math.round(fat * 10) / 10
    };
  }, [plate]);

  // Calcolo Bolo Insulina
  const bolus = useMemo(() => {
    if (!settings.enableBolus) return { mealBolus: 0, corrBolus: 0, totalBolus: 0 };

    const icr = settings.icr[mealType] || 10;
    const mealBolus = icr > 0 ? totals.carbs / icr : 0;

    let corrBolus = 0;
    if (typeof currentBg === 'number' && currentBg > 0) {
      corrBolus = (currentBg - settings.bgTarget) / settings.isf;
    }

    let totalRaw = Math.max(0, mealBolus + corrBolus);
    const step = settings.bolusStep || 0.5;
    const roundedTotal = Math.round(totalRaw / step) * step;

    return {
      mealBolus: Math.round(mealBolus * 10) / 10,
      corrBolus: Math.round(corrBolus * 10) / 10,
      totalBolus: Math.round(roundedTotal * 10) / 10,
      icr
    };
  }, [totals.carbs, currentBg, mealType, settings]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h2>ContaCarbo - Calcolo Carboidrati & Bolo</h2>
      
      {/* Riepilogo Carboidrati */}
      <div style={{ background: '#1e1b4b', color: '#fff', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Totale Pasto</span>
        <div style={{ fontSize: 48, fontWeight: 'bold' }}>{totals.carbs.toFixed(1)} <span style={{ fontSize: 20 }}>g CHO</span></div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, opacity: 0.9 }}>
          <span>Calorie: {totals.calories} kcal</span>
          <span>Proteine: {totals.protein} g</span>
          <span>Grassi: {totals.fat} g</span>
        </div>
      </div>

      {/* Calcolo Bolo Insulina */}
      {settings.enableBolus && (
        <div style={{ background: '#1e293b', color: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Stima Bolo Insulina</strong>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Rapporto: 1U / {bolus.icr}g CHO</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Glicemia pre-pasto (mg/dL)</label>
            <input
              type="number"
              placeholder="Es. 130"
              value={currentBg}
              onChange={(e) => setCurrentBg(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
            />
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 'bold', color: '#38bdf8' }}>{bolus.totalBolus.toFixed(1)}</span>
            <span>Unità (U)</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Pasto: {bolus.mealBolus} U | Correzione: {bolus.corrBolus >= 0 ? `+${bolus.corrBolus}` : bolus.corrBolus} U
          </div>
        </div>
      )}
    </div>
  );
};

export default CarbCalculator;
