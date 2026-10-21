// Este componente contiene el aviso de versión beta web en construcción.
export function renderNotice(container) {
  if (!container) return;
  container.innerHTML = `
    <aside class="notice" aria-label="Aviso de versión beta">
      <span class="notice-icon" aria-hidden="true"></span>
      <span class="notice-label">BETA</span>
      <span class="notice-message">
        Sitio en construcción — Estamos trabajando en nuevas funciones
      </span>
    </aside>
  `;
  container.removeAttribute('aria-busy');
}
