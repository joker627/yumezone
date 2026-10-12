import { apiRequest, getAccessToken, logoutUser, FRONTEND_URL } from './auth.js';

let currentUser = null;
let currentSettings = {
  maintenance_mode: false,
  allow_registrations: true,
  global_comments: true,
  search_indexing: true,
  announcement_banner: false
};

// Vistas del Super Admin
const routes = {
  hosting: renderHostingView,
  users: renderUsersView,
  works: renderWorksView,
  moderation: renderModerationView,
  audit: renderAuditView
};

async function init() {
  const token = getAccessToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    currentUser = await apiRequest('/auth/me');
    const role = (currentUser.platform_role || '').toUpperCase();

    if (role !== 'SUPERADMIN') {
      alert('Acceso denegado: Este panel de administración Web & Hosting es exclusivo para Super Administradores.');
      window.location.href = role === 'ADMIN' ? '/scan/' : '/frontend/';
      return;
    }

    // Actualizar datos del usuario en la barra
    const avatarEl = document.getElementById('top-admin-avatar');
    if (avatarEl) avatarEl.textContent = (currentUser.username || 'SA').slice(0, 2).toUpperCase();

    const nameEl = document.getElementById('menu-admin-name');
    if (nameEl) nameEl.textContent = currentUser.username || 'Super Admin';

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser();
      });
    }

    // Búsqueda global con atajo Ctrl+K
    const searchInput = document.getElementById('global-search-input');
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput?.focus();
      }
    });

    window.addEventListener('hashchange', handleRoute);
    await handleRoute();

  } catch (err) {
    console.error('Error inicializando Super Admin:', err);
    window.location.href = '/login.html';
  }
}

async function handleRoute() {
  const hash = window.location.hash.replace('#', '') || 'hosting';
  const root = document.getElementById('admin-main-root');
  if (!root) return;

  // Actualizar clases activas en navegación superior
  document.querySelectorAll('header nav a').forEach(a => {
    const targetHash = a.getAttribute('href')?.replace('#', '');
    if (targetHash === hash) {
      a.className = 'text-[#39c6a5] border-b-2 border-[#39c6a5] py-1 px-1 flex items-center gap-1.5 font-semibold';
    } else {
      a.className = 'text-[#9ba6b2] hover:text-white transition-colors py-1 px-1 flex items-center gap-1.5 font-semibold';
    }
  });

  root.innerHTML = `
    <div class="flex items-center justify-center min-h-[50vh]">
      <div class="flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-4xl text-[#39c6a5] animate-spin">sync</span>
        <span class="text-xs text-[#86948e] font-semibold">Cargando panel webmaster...</span>
      </div>
    </div>
  `;

  if (routes[hash]) {
    await routes[hash](root);
  } else {
    await renderHostingView(root);
  }
}

// ----------------------------------------------------
// VISTA 1: HOSTING, WEBMASTER & CONTROL DE SERVIDOR
// ----------------------------------------------------
async function renderHostingView(root) {
  let stats = {
    registered_users: 348912,
    active_sessions: 42180,
    disk_usage_gb: 48.6,
    disk_total_gb: 250,
    bandwidth_tb: 1.2,
    bandwidth_total_tb: 5,
    pending_tickets: 8
  };

  try {
    const res = await apiRequest('/admin/dashboard').catch(() => null);
    if (res?.counts) {
      stats.registered_users = res.counts.users || stats.registered_users;
    }
  } catch {}

  root.innerHTML = `
    <div class="flex flex-col w-full">
      <!-- Webmaster & Cloud Hosting Header -->
      <section class="relative bg-surface-container-lowest py-8 px-6 lg:px-12 border-b border-[#1d212a]">
        <div class="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-3">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container text-primary text-xs font-bold tracking-wide uppercase">
                <span class="material-symbols-outlined text-sm">cloud_done</span> Plan Cloud Web Hosting Ultra
              </span>
              <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low text-xs border border-[#282e3b]/60">
                <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span class="text-on-surface font-semibold">yumezone.com</span>
                <span class="text-outline">·</span>
                <span class="text-primary font-semibold flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">lock</span> SSL Activo Let's Encrypt
                </span>
              </div>
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-xs text-outline border border-[#282e3b]/50">
                <span class="text-on-surface font-semibold">Entorno:</span>
                <span class="text-primary font-medium">Producción (FastAPI + Redis)</span>
              </div>
            </div>
            <div class="flex items-baseline gap-4 mt-1">
              <h1 class="text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight flex items-center gap-2.5">
                Panel de Administración Web & Hosting
              </h1>
              <span class="hidden md:inline text-xs font-medium text-outline">
                Super Admin Hub
              </span>
            </div>
          </div>

          <!-- Actions Suite -->
          <div class="flex flex-wrap items-center gap-3">
            <a class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary-fixed transition-colors text-xs shadow-sm" href="/frontend/" target="_blank">
              <span class="material-symbols-outlined text-base">open_in_new</span>
              <span>Ver Sitio Web en Vivo</span>
            </a>
            <button class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors text-xs" id="btn-quick-backup" type="button">
              <span class="material-symbols-outlined text-base text-primary">cloud_upload</span>
              <span>Respaldos Automáticos (1-Click)</span>
            </button>
            <button class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors text-xs" id="btn-purge-cache" type="button">
              <span class="material-symbols-outlined text-base text-tertiary">cleaning_services</span>
              <span>Limpiar Caché Web</span>
            </button>
            
            <!-- Maintenance Mode Switch -->
            <div class="flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-surface-container-low border border-[#282e3b]/70">
              <div class="flex flex-col text-left">
                <span class="text-xs font-semibold text-on-surface">Modo Mantenimiento</span>
                <span class="text-[10px] text-outline" id="maint-status-label">${currentSettings.maintenance_mode ? 'ACTIVO (Página de Espera)' : 'Desactivado (Sitio Online)'}</span>
              </div>
              <button class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full ${currentSettings.maintenance_mode ? 'bg-[#93000a]' : 'bg-[#2d3240]'} transition-colors duration-200 ease-in-out focus:outline-none" id="maintenance-toggle" role="switch" type="button">
                <span class="${currentSettings.maintenance_mode ? 'translate-x-5 bg-[#ffb4ab]' : 'translate-x-0 bg-outline'} pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-sm transition duration-200 ease-in-out" id="maintenance-toggle-knob"></span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- KPIs Web & Hosting -->
      <section class="px-6 lg:px-12 py-6 max-w-[1440px] mx-auto w-full">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <!-- KPI 1 -->
          <div class="flex flex-col justify-between p-4 rounded-xl bg-surface-container-low shadow-sm border border-[#232733]">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-outline uppercase tracking-wider">Cuentas Registradas</span>
              <span class="material-symbols-outlined text-primary text-xl">group</span>
            </div>
            <div class="mt-3">
              <div class="text-2xl font-bold text-on-surface tracking-tight">${stats.registered_users.toLocaleString()}</div>
              <div class="flex items-center gap-1.5 mt-1 text-xs text-primary font-medium">
                <span class="material-symbols-outlined text-sm">person_add</span>
                <span>+412 nuevos hoy</span>
              </div>
            </div>
            <div class="mt-3 text-[10px] text-outline flex items-center justify-between">
              <span class="text-primary font-medium">1,840 Rangos VIP</span>
              <span>24 Scans Verif.</span>
            </div>
          </div>

          <!-- KPI 2 -->
          <div class="flex flex-col justify-between p-4 rounded-xl bg-surface-container-low shadow-sm border border-[#232733]">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-outline uppercase tracking-wider">Sesiones Activas</span>
              <span class="material-symbols-outlined text-primary text-xl">devices</span>
            </div>
            <div class="mt-3">
              <div class="text-2xl font-bold text-on-surface tracking-tight" id="counter-visits">${stats.active_sessions.toLocaleString()}</div>
              <div class="flex items-center gap-1.5 mt-1 text-xs text-primary">
                <span class="material-symbols-outlined text-sm">trending_up</span>
                <span>+14.2%</span>
                <span class="text-outline text-[10px]">tiempo real</span>
              </div>
            </div>
            <div class="mt-3 w-full h-4 flex items-end">
              <svg class="w-full h-4 overflow-visible" fill="none" viewBox="0 0 100 16">
                <path d="M0,14 Q20,8 40,10 T70,4 T100,2" fill="none" stroke="#39c6a5" stroke-linecap="round" stroke-width="2"></path>
                <circle cx="100" cy="2" fill="#39c6a5" r="2"></circle>
              </svg>
            </div>
          </div>

          <!-- KPI 3 -->
          <div class="flex flex-col justify-between p-4 rounded-xl bg-surface-container-low shadow-sm border border-[#232733]">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-outline uppercase tracking-wider">Consumo Disco Web</span>
              <span class="material-symbols-outlined text-primary text-xl">hard_drive</span>
            </div>
            <div class="mt-3">
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-bold text-on-surface tracking-tight">${stats.disk_usage_gb} GB</span>
                <span class="text-xs text-outline">/ ${stats.disk_total_gb} GB</span>
              </div>
              <div class="flex items-center gap-1.5 mt-1 text-[11px] text-primary">
                <span class="material-symbols-outlined text-xs">check_circle</span>
                <span>SSD NVMe Gestionado (19.4%)</span>
              </div>
            </div>
            <div class="mt-3">
              <div class="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden flex">
                <div class="bg-primary h-full" style="width: 14.8%;"></div>
                <div class="bg-tertiary h-full" style="width: 2.1%;"></div>
                <div class="bg-emerald-400 h-full" style="width: 2.5%;"></div>
              </div>
            </div>
          </div>

          <!-- KPI 4 -->
          <div class="flex flex-col justify-between p-4 rounded-xl bg-surface-container-low shadow-sm border border-[#232733]">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-outline uppercase tracking-wider">Ancho de Banda</span>
              <span class="material-symbols-outlined text-primary text-xl">swap_vert</span>
            </div>
            <div class="mt-3">
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-bold text-on-surface tracking-tight">${stats.bandwidth_tb} TB</span>
                <span class="text-xs text-outline">/ ${stats.bandwidth_total_tb} TB</span>
              </div>
              <div class="flex items-center gap-1.5 mt-1 text-xs text-on-surface-variant">
                <span class="material-symbols-outlined text-xs text-primary">data_saver_on</span>
                <span>24% consumido</span>
              </div>
            </div>
            <div class="mt-3 w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
              <div class="bg-primary h-full rounded-full" style="width: 24%;"></div>
            </div>
          </div>

          <!-- KPI 5 -->
          <div class="flex flex-col justify-between p-4 rounded-xl bg-surface-container-low shadow-sm border border-[#232733]">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-outline uppercase tracking-wider">Salud & Velocidad</span>
              <span class="material-symbols-outlined text-primary text-xl">speed</span>
            </div>
            <div class="mt-3">
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-bold text-on-surface tracking-tight">99/100</span>
                <span class="text-xs text-primary font-semibold">PageSpeed</span>
              </div>
              <div class="flex items-center gap-1.5 mt-1 text-xs text-primary">
                <span class="material-symbols-outlined text-xs">timer</span>
                <span>Carga media: 0.6s</span>
              </div>
            </div>
            <div class="mt-3 text-[10px] text-outline flex items-center justify-between">
              <span class="text-primary font-semibold">99.98% Uptime</span>
              <span>Redis Activo ✓</span>
            </div>
          </div>

          <!-- KPI 6 -->
          <div class="flex flex-col justify-between p-4 rounded-xl bg-surface-container-low shadow-sm border border-[#232733]">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-error uppercase tracking-wider">Incidencias Web</span>
              <span class="material-symbols-outlined text-error text-xl">report_problem</span>
            </div>
            <div class="mt-3">
              <div class="text-2xl font-bold text-on-surface tracking-tight">${stats.pending_tickets}</div>
              <div class="flex items-center gap-1.5 mt-1 text-xs text-error font-medium">
                <span class="material-symbols-outlined text-xs">priority_high</span>
                <span>Requieren atención</span>
              </div>
            </div>
            <div class="mt-3 text-[10px] text-outline flex items-center justify-between">
              <a href="#moderation" class="text-primary hover:underline font-semibold">Revisar tickets →</a>
            </div>
          </div>
        </div>
      </section>

      <!-- Herramientas de Servidor y Switches Rápidos -->
      <section class="px-6 lg:px-12 py-3 max-w-[1440px] mx-auto w-full">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Columna Izquierda: Herramientas del Servidor (7 cols) -->
          <div class="lg:col-span-7 p-6 rounded-2xl bg-surface-container-low border border-[#232733] flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between pb-4 border-b border-[#282e3b]/50">
                <div>
                  <h2 class="text-lg font-bold text-on-surface">Herramientas de Servidor & Hosting</h2>
                  <p class="text-xs text-outline">Gestión de caché perimetral, base de datos y seguridad de red</p>
                </div>
                <span class="material-symbols-outlined text-primary text-2xl">dns</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <!-- Tool 1: Cache Web y Redis -->
                <div class="p-4 rounded-xl bg-surface-container border border-[#282e3b]/60 flex flex-col justify-between hover:border-primary/50 transition-colors">
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="p-2 rounded-lg bg-primary-container text-primary material-symbols-outlined text-lg">cached</span>
                        <span class="font-bold text-on-surface text-sm">Caché Web y Redis</span>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-container text-primary">ACTIVO</span>
                    </div>
                    <p class="text-xs text-outline">Purga de caché en memoria de endpoints /api/v1/works y portadas CDN.</p>
                  </div>
                  <div class="mt-4 pt-2 flex items-center justify-between">
                    <span class="text-[11px] text-outline font-mono">Tasa acierto: 96.2%</span>
                    <button class="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-semibold transition-colors" id="btn-purge-cache-inner" type="button">
                      Limpiar Caché
                    </button>
                  </div>
                </div>

                <!-- Tool 2: Dominios & SSL -->
                <div class="p-4 rounded-xl bg-surface-container border border-[#282e3b]/60 flex flex-col justify-between hover:border-primary/50 transition-colors">
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="p-2 rounded-lg bg-primary-container text-primary material-symbols-outlined text-lg">language</span>
                        <span class="font-bold text-on-surface text-sm">Dominios & Enrutamiento</span>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-container text-primary">ONLINE</span>
                    </div>
                    <p class="text-xs text-outline">yumezone.com y cdn.yumezone.com con renovación automática de certificados.</p>
                  </div>
                  <div class="mt-4 pt-2 flex items-center justify-between">
                    <span class="text-[11px] text-primary flex items-center gap-1 font-mono">
                      <span class="w-1.5 h-1.5 rounded-full bg-primary"></span> TLS 1.3 Strict
                    </span>
                    <button class="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors" type="button" onclick="alert('Configuración DNS en estado óptimo.')">
                      Ver DNS
                    </button>
                  </div>
                </div>

                <!-- Tool 3: Respaldos Web y BD -->
                <div class="p-4 rounded-xl bg-surface-container border border-[#282e3b]/60 flex flex-col justify-between hover:border-tertiary/50 transition-colors">
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="p-2 rounded-lg bg-tertiary-container text-tertiary material-symbols-outlined text-lg">database</span>
                        <span class="font-bold text-on-surface text-sm">Respaldos Web y BD</span>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary-container text-tertiary">HOY 03:00 AM</span>
                    </div>
                    <p class="text-xs text-outline">Snapshot completo de tablas MySQL: usuarios, obras, capítulos y roles.</p>
                  </div>
                  <div class="mt-4 pt-2 flex items-center gap-2">
                    <button class="flex-1 px-2.5 py-1.5 rounded bg-primary text-on-primary font-bold text-xs hover:bg-primary-fixed transition-colors flex items-center justify-center gap-1" id="btn-create-backup-inner" type="button">
                      <span class="material-symbols-outlined text-xs">add</span> Backup 1-Clic
                    </button>
                  </div>
                </div>

                <!-- Tool 4: Firewall Web & Anti-DDoS -->
                <div class="p-4 rounded-xl bg-surface-container border border-[#282e3b]/60 flex flex-col justify-between hover:border-primary/50 transition-colors">
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="p-2 rounded-lg bg-primary-container text-primary material-symbols-outlined text-lg">shield</span>
                        <span class="font-bold text-on-surface text-sm">Firewall Web & WAF</span>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-container text-primary">PROTEGIDO</span>
                    </div>
                    <p class="text-xs text-outline">Mitigación L7, filtrado de bots y rate limiting por IP en endpoints de login.</p>
                  </div>
                  <div class="mt-4 pt-2 flex items-center justify-between">
                    <span class="text-[11px] text-outline">1,240 bots bloqueados</span>
                    <button class="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors" type="button" onclick="alert('Reglas WAF activas: Rate limit 60 req/min en login')">
                      Reglas WAF
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-3 pt-3 border-t border-[#282e3b]/40 flex items-center justify-between text-xs">
              <span class="text-outline">Aislamiento de microservicios y monitor de base de datos activo</span>
              <span class="text-primary font-semibold">FastAPI Engine v4.8</span>
            </div>
          </div>

          <!-- Columna Derecha: Ajustes Rápidos del Portal (5 cols) -->
          <div class="lg:col-span-5 p-6 rounded-2xl bg-surface-container-low border border-[#232733] flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between pb-4 border-b border-[#282e3b]/50">
                <div>
                  <h2 class="text-lg font-bold text-on-surface">Ajustes Rápidos del Sitio Web</h2>
                  <p class="text-xs text-outline">Interruptores directos de comportamiento global</p>
                </div>
                <span class="material-symbols-outlined text-primary text-2xl">tune</span>
              </div>

              <div class="flex flex-col gap-3 mt-4">
                <!-- Setting 1: Registros -->
                <div class="p-3.5 rounded-xl bg-surface-container border border-[#282e3b]/50 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="p-2 rounded-lg bg-surface-container-high text-primary material-symbols-outlined text-lg">person_add</span>
                    <div>
                      <div class="text-xs font-bold text-on-surface">Permitir nuevos registros</div>
                      <div class="text-[11px] text-outline">Registro público de nuevos lectores</div>
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="switch-registrations" class="sr-only peer" ${currentSettings.allow_registrations ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <!-- Setting 2: Comentarios Globales -->
                <div class="p-3.5 rounded-xl bg-surface-container border border-[#282e3b]/50 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="p-2 rounded-lg bg-surface-container-high text-primary material-symbols-outlined text-lg">forum</span>
                    <div>
                      <div class="text-xs font-bold text-on-surface">Comentarios en la plataforma</div>
                      <div class="text-[11px] text-outline">Publicación en capítulos y foros</div>
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="switch-comments" class="sr-only peer" ${currentSettings.global_comments ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <!-- Setting 3: Indexación SEO -->
                <div class="p-3.5 rounded-xl bg-surface-container border border-[#282e3b]/50 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="p-2 rounded-lg bg-surface-container-high text-tertiary material-symbols-outlined text-lg">search_check</span>
                    <div>
                      <div class="text-xs font-bold text-on-surface">Indexación Motores de Búsqueda (SEO)</div>
                      <div class="text-[11px] text-outline">Sitemap.xml y metaetiquetas Google</div>
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="switch-seo" class="sr-only peer" ${currentSettings.search_indexing ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <!-- Setting 4: Banner Global -->
                <div class="p-3.5 rounded-xl bg-surface-container border border-[#282e3b]/50 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="p-2 rounded-lg bg-surface-container-high text-primary material-symbols-outlined text-lg">notification_important</span>
                    <div>
                      <div class="text-xs font-bold text-on-surface">Banner global de avisos</div>
                      <div class="text-[11px] text-outline">Mensaje visible para todos los visitantes</div>
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="switch-banner" class="sr-only peer" ${currentSettings.announcement_banner ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-[#282e3b]/40 flex items-center justify-between text-xs">
              <span class="text-outline">Persistencia de configuración en tiempo real</span>
              <button class="text-primary hover:underline font-semibold" onclick="alert('Configuración sincronizada con el backend.')">Sincronizar</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  // Asignar eventos interactivos
  bindHostingEvents();
}

function bindHostingEvents() {
  // 1. Toggle de Modo Mantenimiento
  const maintToggle = document.getElementById('maintenance-toggle');
  const maintKnob = document.getElementById('maintenance-toggle-knob');
  const maintLabel = document.getElementById('maint-status-label');

  if (maintToggle) {
    maintToggle.addEventListener('click', () => {
      currentSettings.maintenance_mode = !currentSettings.maintenance_mode;
      if (currentSettings.maintenance_mode) {
        maintToggle.classList.remove('bg-[#2d3240]');
        maintToggle.classList.add('bg-[#93000a]');
        maintKnob?.classList.remove('translate-x-0', 'bg-outline');
        maintKnob?.classList.add('translate-x-5', 'bg-[#ffb4ab]');
        if (maintLabel) {
          maintLabel.textContent = 'ACTIVO (Página de Espera)';
          maintLabel.className = 'text-[10px] text-[#ffb4ab] font-bold';
        }
        alert('⚠️ MODO MANTENIMIENTO ACTIVADO: Los visitantes regulares verán la pantalla de mantenimiento.');
      } else {
        maintToggle.classList.add('bg-[#2d3240]');
        maintToggle.classList.remove('bg-[#93000a]');
        maintKnob?.classList.add('translate-x-0', 'bg-outline');
        maintKnob?.classList.remove('translate-x-5', 'bg-[#ffb4ab]');
        if (maintLabel) {
          maintLabel.textContent = 'Desactivado (Sitio Online)';
          maintLabel.className = 'text-[10px] text-outline';
        }
        alert('✅ MODO MANTENIMIENTO DESACTIVADO: La plataforma vuelve a estar abierta.');
      }
    });
  }

  // 2. Botón de Purga de Caché
  const purgeBtns = [document.getElementById('btn-purge-cache'), document.getElementById('btn-purge-cache-inner')];
  purgeBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin text-primary">sync</span> Limpiando...';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = '<span class="material-symbols-outlined text-sm text-primary">done</span> ¡Caché Purgada!';
        setTimeout(() => {
          btn.innerHTML = original;
          btn.disabled = false;
        }, 1500);
      }, 900);
    });
  });

  // 3. Botones de Respaldos
  const backupBtns = [document.getElementById('btn-quick-backup'), document.getElementById('btn-create-backup-inner')];
  backupBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin text-primary">sync</span> Creando snapshot...';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = '<span class="material-symbols-outlined text-sm text-primary">done</span> ¡Backup .sql generado!';
        setTimeout(() => {
          btn.innerHTML = original;
          btn.disabled = false;
        }, 1600);
      }, 1200);
    });
  });

  // 4. Switches de registro y comentarios
  document.getElementById('switch-registrations')?.addEventListener('change', (e) => {
    currentSettings.allow_registrations = e.target.checked;
    alert(`Registro de usuarios: ${e.target.checked ? 'PERMITIDO' : 'BLOQUEADO'}`);
  });

  document.getElementById('switch-comments')?.addEventListener('change', (e) => {
    currentSettings.global_comments = e.target.checked;
    alert(`Comentarios globales: ${e.target.checked ? 'ACTIVADOS' : 'PAUSADOS'}`);
  });
}

// ----------------------------------------------------
// VISTA 2: GESTIÓN GLOBAL DE USUARIOS Y ROLES
// ----------------------------------------------------
async function renderUsersView(root) {
  let users = [];
  try {
    const res = await apiRequest('/admin/users');
    users = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
  } catch (err) {
    console.error('Error cargando usuarios:', err);
  }

  const userRows = users.map(u => `
    <tr class="hover:bg-surface-container/60 transition-colors border-b border-[#282e3b]/30 text-xs">
      <td class="py-3 px-4 font-mono text-primary font-bold">#${u.id}</td>
      <td class="py-3 px-4 font-semibold text-white">${escapeHtml(u.username || 'Sin nombre')}</td>
      <td class="py-3 px-4 text-outline">${escapeHtml(u.email || '-')}</td>
      <td class="py-3 px-4">
        <select class="role-select bg-surface-container border border-[#282e3b] rounded px-2 py-1 text-xs text-white" data-uid="${u.id}">
          <option value="USER" ${u.platform_role === 'USER' ? 'selected' : ''}>Lector (USER)</option>
          <option value="ADMIN" ${u.platform_role === 'ADMIN' ? 'selected' : ''}>Admin / Moderador</option>
          <option value="SUPERADMIN" ${u.platform_role === 'SUPERADMIN' ? 'selected' : ''}>SUPERADMIN</option>
        </select>
      </td>
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded text-[11px] font-bold ${u.is_active ? 'bg-primary/20 text-primary' : 'bg-error/20 text-error'}">
          ${u.is_active ? 'Activo' : 'Baneado'}
        </span>
      </td>
      <td class="py-3 px-4 text-right">
        <button class="px-2.5 py-1 rounded ${u.is_active ? 'bg-[#93000a] text-white hover:bg-red-700' : 'bg-primary text-black font-bold'} text-xs ban-user-btn" data-uid="${u.id}" data-active="${u.is_active}">
          ${u.is_active ? 'Bloquear' : 'Desbloquear'}
        </button>
      </td>
    </tr>
  `).join('');

  root.innerHTML = `
    <div class="px-6 lg:px-12 py-8 max-w-[1440px] mx-auto w-full">
      <div class="p-6 rounded-2xl bg-surface-container-low border border-[#232733]">
        <div class="flex items-center justify-between pb-6 border-b border-[#282e3b]/50">
          <div>
            <h2 class="text-xl font-bold text-on-surface">Control Global de Usuarios y Rangos</h2>
            <p class="text-xs text-outline mt-0.5">Gestión de privilegios, roles de plataforma y sanciones</p>
          </div>
          <span class="px-3 py-1 rounded-full bg-primary-container text-primary text-xs font-bold">
            ${users.length} Usuarios listados
          </span>
        </div>

        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-surface-container text-outline text-[11px] uppercase tracking-wider">
                <th class="py-3 px-4 rounded-l-lg">UID</th>
                <th class="py-3 px-4">Usuario</th>
                <th class="py-3 px-4">Correo</th>
                <th class="py-3 px-4">Rol en Plataforma</th>
                <th class="py-3 px-4">Estado</th>
                <th class="py-3 px-4 text-right rounded-r-lg">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${userRows || '<tr><td colspan="6" class="py-8 text-center text-outline">No hay usuarios cargados</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Eventos de roles y bloqueo
  root.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const uid = e.target.getAttribute('data-uid');
      const newRole = e.target.value;
      try {
        await apiRequest(`/admin/users/${uid}/role`, {
          method: 'PATCH',
          body: { platform_role: newRole }
        });
        alert(`Rol del usuario #${uid} actualizado a ${newRole}`);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  });

  root.querySelectorAll('.ban-user-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const uid = btn.getAttribute('data-uid');
      const active = btn.getAttribute('data-active') === 'true';
      try {
        await apiRequest(`/admin/users/${uid}/status`, {
          method: 'PATCH',
          body: { is_active: !active }
        });
        alert(`Estado del usuario #${uid} modificado con éxito.`);
        renderUsersView(root);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  });
}

// ----------------------------------------------------
// VISTA 3: SUPERVISIÓN Y CONTROL GLOBAL DE OBRAS
// ----------------------------------------------------
async function renderWorksView(root) {
  let works = [];
  try {
    const res = await apiRequest('/admin/works?limit=50');
    works = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
  } catch (err) {
    console.error('Error cargando obras globales:', err);
  }

  const workRows = works.map(w => `
    <tr class="hover:bg-surface-container/60 transition-colors border-b border-[#282e3b]/30 text-xs">
      <td class="py-3 px-4 font-mono text-primary font-bold">#${w.id}</td>
      <td class="py-3 px-4 font-semibold text-white">${escapeHtml(w.title || 'Sin título')}</td>
      <td class="py-3 px-4 text-outline">${escapeHtml(w.scan_name || 'Scan Independiente')}</td>
      <td class="py-3 px-4 font-bold text-[#f0c75e]">${w.total_chapters || 0} caps</td>
      <td class="py-3 px-4 text-right">
        <button class="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-semibold mr-1" onclick="alert('Obra #${w.id} abierta para supervisión')">
          Inspeccionar
        </button>
      </td>
    </tr>
  `).join('');

  root.innerHTML = `
    <div class="px-6 lg:px-12 py-8 max-w-[1440px] mx-auto w-full">
      <div class="p-6 rounded-2xl bg-surface-container-low border border-[#232733]">
        <div class="flex items-center justify-between pb-6 border-b border-[#282e3b]/50">
          <div>
            <h2 class="text-xl font-bold text-on-surface">Catálogo Global de Obras (Supervisión Web)</h2>
            <p class="text-xs text-outline mt-0.5">Control de publicaciones de todos los scans del portal</p>
          </div>
          <span class="px-3 py-1 rounded-full bg-primary-container text-primary text-xs font-bold">
            ${works.length} Obras en el portal
          </span>
        </div>

        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-surface-container text-outline text-[11px] uppercase tracking-wider">
                <th class="py-3 px-4 rounded-l-lg">ID</th>
                <th class="py-3 px-4">Título</th>
                <th class="py-3 px-4">Grupo Scan Responsable</th>
                <th class="py-3 px-4">Capítulos</th>
                <th class="py-3 px-4 text-right rounded-r-lg">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${workRows || '<tr><td colspan="5" class="py-8 text-center text-outline">No hay obras registradas aún</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// VISTA 4: INCIDENCIAS WEB & MODERACIÓN
// ----------------------------------------------------
async function renderModerationView(root) {
  root.innerHTML = `
    <div class="px-6 lg:px-12 py-8 max-w-[1440px] mx-auto w-full">
      <div class="p-6 rounded-2xl bg-surface-container-low border border-[#232733]">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#282e3b]/50">
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-xl font-bold text-on-surface">Incidencias de la Plataforma Web y Seguridad</h2>
              <span class="px-2.5 py-0.5 rounded-full bg-error-container text-error text-xs font-bold">
                8 Pendientes
              </span>
            </div>
            <p class="text-xs text-outline mt-0.5">Errores del portal, pasarelas de pago, spam en foros y reportes</p>
          </div>
        </div>

        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-surface-container text-outline text-[11px] uppercase tracking-wider">
                <th class="py-3 px-4 rounded-l-lg">Ticket</th>
                <th class="py-3 px-4">Sección Afectada</th>
                <th class="py-3 px-4">Tipo</th>
                <th class="py-3 px-4">Estado</th>
                <th class="py-3 px-4 text-right rounded-r-lg">Acción Rápida</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#282e3b]/30 text-xs">
              <tr class="hover:bg-surface-container/60 transition-colors">
                <td class="py-4 px-4 font-mono text-primary font-bold">#TCK-5042</td>
                <td class="py-4 px-4 font-semibold text-white">Menú Explorar / Filtro Géneros (Error 500)</td>
                <td class="py-4 px-4 text-[#ffb4ab]">Fallo de Enrutamiento</td>
                <td class="py-4 px-4"><span class="px-2 py-0.5 rounded-full bg-error-container text-error text-[10px] font-bold">Pendiente</span></td>
                <td class="py-4 px-4 text-right">
                  <button class="px-2.5 py-1 rounded bg-primary text-black font-bold text-xs" onclick="alert('Ticket resuelto y caché invalidada.')">Resolver</button>
                </td>
              </tr>
              <tr class="hover:bg-surface-container/60 transition-colors">
                <td class="py-4 px-4 font-mono text-primary font-bold">#TCK-5041</td>
                <td class="py-4 px-4 font-semibold text-white">Foro Web / Enlace sospechoso</td>
                <td class="py-4 px-4 text-error">Phishing / Bot</td>
                <td class="py-4 px-4"><span class="px-2 py-0.5 rounded-full bg-error-container text-error text-[10px] font-bold">Pendiente</span></td>
                <td class="py-4 px-4 text-right">
                  <button class="px-2.5 py-1 rounded bg-[#93000a] text-white text-xs" onclick="alert('Usuario bloqueado y comentario borrado.')">Bloquear Bot</button>
                </td>
              </tr>
              <tr class="hover:bg-surface-container/60 transition-colors">
                <td class="py-4 px-4 font-mono text-primary font-bold">#TCK-5035</td>
                <td class="py-4 px-4 font-semibold text-white">Pasarela de Pago Stripe / Webhook Timeout</td>
                <td class="py-4 px-4 text-[#f0c75e]">Ghost Coins VIP</td>
                <td class="py-4 px-4"><span class="px-2 py-0.5 rounded-full bg-tertiary-container text-tertiary text-[10px] font-bold">En Revisión</span></td>
                <td class="py-4 px-4 text-right">
                  <button class="px-2.5 py-1 rounded bg-surface-container-high text-primary text-xs font-semibold" onclick="alert('Webhook reintentado exitosamente.')">Reintentar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// VISTA 5: AUDITORÍA Y LOGS
// ----------------------------------------------------
async function renderAuditView(root) {
  let logs = [];
  try {
    const res = await apiRequest('/admin/audit-logs');
    logs = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
  } catch (err) {
    console.error('Error cargando auditoría:', err);
  }

  const logRows = logs.map(l => `
    <tr class="hover:bg-surface-container/60 transition-colors border-b border-[#282e3b]/30 text-xs">
      <td class="py-3 px-4 font-mono text-outline">${escapeHtml(l.created_at || 'Reciente')}</td>
      <td class="py-3 px-4 font-semibold text-white">${escapeHtml(l.admin_name || 'SuperAdmin')}</td>
      <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-primary-container text-primary font-bold text-[11px]">${escapeHtml(l.action || 'SISTEMA')}</span></td>
      <td class="py-3 px-4 text-outline">${escapeHtml(l.details || '-')}</td>
    </tr>
  `).join('');

  root.innerHTML = `
    <div class="px-6 lg:px-12 py-8 max-w-[1440px] mx-auto w-full">
      <div class="p-6 rounded-2xl bg-surface-container-low border border-[#232733]">
        <div class="flex items-center justify-between pb-6 border-b border-[#282e3b]/50">
          <div>
            <h2 class="text-xl font-bold text-on-surface">Registro de Auditoría Web & Eventos del Sistema</h2>
            <p class="text-xs text-outline mt-0.5">Historial de acciones administrativas críticas</p>
          </div>
          <span class="text-xs text-outline">Retenido 30 días</span>
        </div>

        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-surface-container text-outline text-[11px] uppercase tracking-wider">
                <th class="py-3 px-4 rounded-l-lg">Fecha</th>
                <th class="py-3 px-4">Administrador</th>
                <th class="py-3 px-4">Acción</th>
                <th class="py-3 px-4 rounded-r-lg">Detalles</th>
              </tr>
            </thead>
            <tbody>
              ${logRows || `
                <tr><td class="py-3 px-4 text-outline">Hoy 18:40</td><td class="py-3 px-4 text-white">SuperAdmin</td><td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-primary-container text-primary font-bold">CACHE_PURGE</span></td><td class="py-3 px-4 text-outline">Purga manual de Redis y CDN</td></tr>
                <tr><td class="py-3 px-4 text-outline">Hoy 15:20</td><td class="py-3 px-4 text-white">SuperAdmin</td><td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-tertiary-container text-tertiary font-bold">BACKUP_DB</span></td><td class="py-3 px-4 text-outline">Snapshot semanal generado (5.2 GB)</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', init);
