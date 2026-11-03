import { apiRequest, getAccessToken, clearAccessToken } from '../shared/auth.js';
import { showToast } from '../shared/toast.js';

let modalEl = null;
let activeState = {
  workId: null,
  workTitle: '',
  selectedScore: null,
  userHasRated: false,
  onRated: null,
};

function getDescriptor(score) {
  if (score == null) return 'Selecciona una puntuación de 1 a 10';
  if (score >= 9.5) return '★ Obra Maestra';
  if (score >= 8.5) return '★ Excelente';
  if (score >= 7.0) return '★ Muy Buena';
  if (score >= 5.5) return '★ Entretenida';
  if (score >= 4.0) return '★ Regular';
  return '★ Baja calificación';
}

function ensureModalDOM() {
  if (modalEl) return modalEl;

  modalEl = document.createElement('dialog');
  modalEl.id = 'yz-global-rating-modal';
  modalEl.className = 'yz-rating-modal';
  modalEl.setAttribute('aria-labelledby', 'yz-rating-modal-title');

  modalEl.innerHTML = `
    <div class="yz-rating-card">
      <header class="yz-rating-head">
        <div class="yz-rating-title-wrap">
          <h2 id="yz-rating-modal-title" class="yz-rating-title">Calificar Obra</h2>
          <p class="yz-rating-subtitle" data-yz-rating-work-title>Obra</p>
        </div>
        <button type="button" class="yz-rating-close" data-yz-rating-close aria-label="Cerrar">&times;</button>
      </header>

      <div class="yz-rating-body">
        <div class="yz-rating-score-row">
          <span class="yz-rating-score-val" data-yz-rating-num>—</span>
          <span class="yz-rating-score-max">/ 10</span>
        </div>
        <div class="yz-rating-label" data-yz-rating-label>Desliza para elegir tu puntuación</div>

        <!-- Barra de selección / Slider decimal (1.0 a 10.0 en pasos de 0.1) -->
        <div class="yz-rating-slider-wrap">
          <input type="range" class="yz-rating-slider" data-yz-rating-slider min="1.0" max="10.0" step="0.1" value="8.0">
          <div class="yz-rating-slider-ticks">
            <span>1.0</span>
            <span>3.0</span>
            <span>5.0</span>
            <span>7.0</span>
            <span>8.5</span>
            <span>10.0</span>
          </div>
        </div>
      </div>

      <footer class="yz-rating-foot">
        <button type="button" class="yz-rating-btn yz-rating-btn--ghost" data-yz-rating-close>Cancelar</button>
        <button type="button" class="yz-rating-btn yz-rating-btn--primary" data-yz-rating-submit>Guardar</button>
      </footer>
    </div>
  `;

  document.body.appendChild(modalEl);

  const slider = modalEl.querySelector('[data-yz-rating-slider]');
  const submitBtn = modalEl.querySelector('[data-yz-rating-submit]');

  slider.addEventListener('input', (e) => {
    setScore(Number(e.target.value), false);
  });

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl || e.target.closest('[data-yz-rating-close]')) {
      closeWorkRatingModal();
    }
  });

  submitBtn.addEventListener('click', handleSubmit);

  return modalEl;
}

function setScore(score, updateSlider = true) {
  const modal = ensureModalDOM();
  const numEl = modal.querySelector('[data-yz-rating-num]');
  const labelEl = modal.querySelector('[data-yz-rating-label]');
  const slider = modal.querySelector('[data-yz-rating-slider]');

  if (score == null || Number.isNaN(score)) {
    activeState.selectedScore = null;
    numEl.textContent = '—';
    labelEl.textContent = getDescriptor(null);
    if (slider) {
      slider.style.background = '#1e2636';
    }
    return;
  }

  const val = Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  activeState.selectedScore = val;
  numEl.textContent = val.toFixed(1);
  labelEl.textContent = getDescriptor(val);

  if (slider) {
    if (updateSlider) {
      slider.value = String(val);
    }
    const pct = Math.max(0, Math.min(100, ((val - 1.0) / 9.0) * 100));
    slider.style.background = `linear-gradient(to right, #f97316 0%, #f59e0b ${pct}%, #1e2636 ${pct}%, #1e2636 100%)`;
  }
}

export function closeWorkRatingModal() {
  if (!modalEl) return;
  if (typeof modalEl.close === 'function') {
    modalEl.close();
  } else {
    modalEl.removeAttribute('open');
  }
}

async function handleSubmit() {
  const { workId, selectedScore, userHasRated, onRated } = activeState;
  if (!workId) return;

  if (!getAccessToken()) {
    closeWorkRatingModal();
    showToast('Inicia sesión para calificar esta obra.', 'info');
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/pages/login.html?next=${encodeURIComponent(next)}`);
    return;
  }

  if (selectedScore == null) {
    showToast('Selecciona una puntuación antes de guardar.', 'warning');
    return;
  }

  const submitBtn = modalEl.querySelector('[data-yz-rating-submit]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando…';

  try {
    const res = await apiRequest(`/library/${workId}/rating`, {
      method: 'POST',
      body: { rating: selectedScore },
    });

    if (typeof onRated === 'function') {
      onRated({
        userRating: selectedScore,
        ratingAverage: res?.rating_average,
        ratingCount: res?.rating_count,
      });
    }

    closeWorkRatingModal();
    showToast(userHasRated ? '¡Calificación actualizada!' : '¡Calificación guardada!', 'success');
  } catch (err) {
    if (err.status === 401 || err.status === 400) {
      clearAccessToken();
      showToast('Tu sesión ha expirado. Inicia sesión nuevamente.', 'error');
      return;
    }
    showToast(err.message || 'No se pudo guardar la calificación.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = activeState.userHasRated ? 'Actualizar' : 'Guardar';
  }
}

export async function openWorkRatingModal({ workId, workTitle = 'Obra', initialScore = null, onRated = null }) {
  if (!workId) return;

  const modal = ensureModalDOM();
  activeState = {
    workId,
    workTitle,
    selectedScore: initialScore != null ? Number(initialScore) : null,
    userHasRated: false,
    onRated,
  };

  modal.querySelector('[data-yz-rating-work-title]').textContent = workTitle;
  const submitBtn = modal.querySelector('[data-yz-rating-submit]');
  const labelEl = modal.querySelector('[data-yz-rating-label]');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Guardar';
  setScore(initialScore != null ? Number(initialScore) : null);

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }

  if (!getAccessToken()) {
    labelEl.textContent = 'Inicia sesión para registrar tu voto';
    submitBtn.textContent = 'Iniciar sesión';
    return;
  }

  try {
    const data = await apiRequest(`/library/${workId}/rating`);
    if (data && data.user_rating != null) {
      activeState.userHasRated = true;
      submitBtn.textContent = 'Actualizar';
      setScore(Number(data.user_rating));
    }
  } catch {}
}

