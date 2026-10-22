import { apiRequest } from '../api/auth.js';
import { showToast } from '../components/toast.js';
import { setListMessage } from '../components/table.js';
import { syncSettingsSwitches } from './inicio.js';

async function saveSetting(key, value, description) {
  const body = description === undefined ? { value } : { value, description };
  await apiRequest(`/admin/settings/${key}`, { method: 'PUT', body });
  showToast(`Directiva ${key} actualizada.`, 'success');
}

function buildRow(tmpl, setting) {
  const clone = tmpl.content.cloneNode(true);
  const field = (name) => clone.querySelector(`[data-field="${name}"]`);
  const key = setting.setting_key;

  field('key').textContent = key;
  field('desc').textContent = setting.description || 'Sin descripción';

  const isBoolean = setting.setting_value === 'true' || setting.setting_value === 'false';

  if (isBoolean) {
    field('switch-wrap').hidden = false;
    const input = field('switch-input');
    input.checked = setting.setting_value === 'true';
    input.addEventListener('change', async () => {
      try {
        await saveSetting(key, input.checked ? 'true' : 'false');
      } catch (err) {
        showToast(err.message, 'error');
        input.checked = !input.checked;
      }
    });
  } else {
    field('text-wrap').hidden = false;
    const input = field('text-input');
    input.value = setting.setting_value;
    clone.querySelector('[data-action="save-setting"]').addEventListener('click', async () => {
      try {
        await saveSetting(key, input.value.trim());
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  return clone;
}

export async function loadAjustes() {
  const container = document.getElementById('settings-list-container');
  const tmpl = document.getElementById('tmpl-setting-row');

  setListMessage(container, 'Cargando ajustes...');

  try {
    const list = await apiRequest('/admin/settings');
    const settings = Array.isArray(list) ? list : [];

    if (!settings.length) {
      setListMessage(container, 'No hay directivas guardadas en platform_settings.');
      return;
    }
    container.replaceChildren(...settings.map((s) => buildRow(tmpl, s)));
  } catch (err) {
    setListMessage(container, `Error cargando directivas: ${err.message}`);
  }
}

function initSettingForm() {
  const form = document.getElementById('setting-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-setting');
    const key = document.getElementById('setting-key-input')?.value.trim();
    const value = document.getElementById('setting-value-input')?.value.trim();
    const description = document.getElementById('setting-desc-input')?.value.trim();

    if (!key || !value) return;

    btn.disabled = true;
    try {
      await saveSetting(key, value, description);
      form.reset();
      await loadAjustes();
      await syncSettingsSwitches();
    } catch (err) {
      showToast(err.message || 'Error al guardar directiva', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

export function initAjustes() {
  document.getElementById('btn-refresh-settings')?.addEventListener('click', loadAjustes);
  initSettingForm();
}
