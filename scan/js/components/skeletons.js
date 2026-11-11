// Componente de Esqueletos de Carga para Scan Studio
// Idéntico en patrón a frontend/js/components/skeletons.js

export function renderWorksCatalogSkeletons(count = 3) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="series-catalog-row is-skeleton" aria-hidden="true" style="opacity: 0.7; pointer-events: none;">
        <div class="series-info-group" style="flex: 1;">
          <div class="scan-skeleton" style="width: 48px; height: 64px; border-radius: 8px; flex-shrink: 0;"></div>
          <div class="series-text-block" style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; gap: 6px;">
              <span class="is-loading is-loading--xs is-loading--w40"></span>
              <span class="is-loading is-loading--xs is-loading--w60"></span>
            </div>
            <span class="is-loading is-loading--md is-loading--w70" style="height: 18px;"></span>
            <span class="is-loading is-loading--sm is-loading--w50"></span>
          </div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <span class="is-loading" style="width: 80px; height: 32px; border-radius: 8px;"></span>
          <span class="is-loading" style="width: 32px; height: 32px; border-radius: 8px;"></span>
          <span class="is-loading" style="width: 32px; height: 32px; border-radius: 8px;"></span>
        </div>
      </div>
    `;
  }
  return html;
}

export function renderChaptersListSkeletons(count = 4) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="chapter-row-item is-skeleton" aria-hidden="true" style="opacity: 0.7; pointer-events: none; padding: 0.75rem 1rem; background: #191b23; border: 1px solid rgba(60, 74, 69, 0.3); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
          <span class="is-loading is-loading--sm" style="width: 50px;"></span>
          <span class="is-loading is-loading--md is-loading--w60"></span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="is-loading is-loading--pill" style="width: 90px;"></span>
          <span class="is-loading" style="width: 70px; height: 28px; border-radius: 6px;"></span>
        </div>
      </div>
    `;
  }
  return html;
}

export function renderSquadSkeletons(count = 4) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="member-bento-card is-skeleton" aria-hidden="true" style="opacity: 0.7; pointer-events: none;">
        <div class="member-card-top">
          <div style="display: flex; align-items: center; gap: 0.65rem; width: 100%;">
            <div class="scan-skeleton is-loading--circle" style="width: 42px; height: 42px; flex-shrink: 0;"></div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
              <span class="is-loading is-loading--sm is-loading--w60"></span>
              <span class="is-loading is-loading--xs is-loading--w40"></span>
            </div>
            <span class="is-loading is-loading--pill" style="width: 65px; height: 22px;"></span>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin: 0.5rem 0;">
          <span class="is-loading is-loading--xs is-loading--w80"></span>
          <span class="is-loading is-loading--xs is-loading--w60"></span>
        </div>
        <div style="display: flex; gap: 6px;">
          <span class="is-loading" style="flex: 1; height: 30px; border-radius: 8px;"></span>
          <span class="is-loading" style="width: 32px; height: 30px; border-radius: 8px;"></span>
        </div>
      </div>
    `;
  }
  return html;
}

export function renderTreasurySkeletons() {
  return `
    <div class="treasury-widget-box is-skeleton" aria-hidden="true" style="opacity: 0.7; pointer-events: none;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
        <span class="is-loading is-loading--sm is-loading--w40"></span>
        <span class="is-loading is-loading--pill" style="width: 120px;"></span>
      </div>
      <span class="is-loading is-loading--lg is-loading--w50" style="height: 2.2rem; margin-bottom: 0.5rem; display: block;"></span>
      <span class="is-loading is-loading--sm is-loading--w70"></span>
    </div>
  `;
}
