// Este componente contiene su aviso independiente de versión beta.
export function renderNotice(container) {
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
