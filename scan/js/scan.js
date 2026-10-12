import { apiRequest, getAccessToken, logoutUser, FRONTEND_URL } from './auth.js';

let currentUser = null;
let currentScan = {
  id: 1,
  name: "Ghost Scans [Official Team]",
  role: "LÍDER",
  active_series: 18,
  total_chapters: 420,
  accumulated_views: "4.8M",
  active_members: 12,
  monthly_balance: 1420.00
};

// Rutas de navegación del Scan
const routes = {
  dashboard: renderDashboardView,
  pipeline: renderPipelineView,
  works: renderWorksView,
  squad: renderSquadView,
  finances: renderFinancesView
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
    const isSuperAdmin = role === 'SUPERADMIN';
    const isStaff = ['ADMIN', 'SUPERADMIN'].includes(role);

    // Verificar si pertenece a algún scan
    let myScans = [];
    try {
      const res = await apiRequest('/admin/my-scan-groups');
      myScans = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch {}

    const isScanMember = myScans.length > 0;

    if (!isStaff && !isScanMember) {
      alert('Acceso restringido: Se requieren permisos de Scanlation o Staff para acceder a este panel.');
      window.location.href = '/frontend/';
      return;
    }

    if (myScans.length > 0) {
      currentScan.name = myScans[0].name || currentScan.name;
      currentScan.id = myScans[0].id || currentScan.id;
    }

    // Configurar interfaz superior
    const avatarEl = document.getElementById('top-scan-avatar');
    if (avatarEl) avatarEl.textContent = (currentUser.username || 'SC').slice(0, 2).toUpperCase();

    const nameEl = document.getElementById('menu-scan-user');
    if (nameEl) nameEl.textContent = currentUser.username || 'Scan Member';

    const roleEl = document.getElementById('menu-scan-role');
    if (roleEl) roleEl.textContent = isSuperAdmin ? 'SUPERADMIN (SUPERVISIÓN)' : 'SCAN TEAM';

    // Mostrar acceso al Panel Webmaster si es Superadmin
    if (isSuperAdmin) {
      const hostingLink = document.getElementById('link-superadmin-hosting');
      const ddLink = document.getElementById('dropdown-superadmin-link');
      if (hostingLink) hostingLink.classList.remove('hidden'), hostingLink.classList.add('flex');
      if (ddLink) ddLink.hidden = false;
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser();
      });
    }

    window.addEventListener('hashchange', handleRoute);
    await handleRoute();

  } catch (err) {
    console.error('Error inicializando Panel de Scan:', err);
    window.location.href = '/login.html';
  }
}

async function handleRoute() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  const root = document.getElementById('scan-main-root');
  if (!root) return;

  // Actualizar enlaces de cabecera
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
        <span class="material-symbols-outlined text-4xl text-[#f0c75e] animate-spin">sync</span>
        <span class="text-xs text-[#86948e] font-semibold">Cargando panel de scan...</span>
      </div>
    </div>
  `;

  if (routes[hash]) {
    await routes[hash](root);
  } else {
    await renderDashboardView(root);
  }
}

// ----------------------------------------------------
// VISTA 1: DASHBOARD GENERAL & BANNER DEL SCAN
// ----------------------------------------------------
async function renderDashboardView(root) {
  root.innerHTML = `
    <div class="flex flex-col w-full">
      <!-- Banner Cabecera del Grupo -->
      <div class="relative w-full overflow-hidden bg-surface-container-lowest">
        <div class="relative w-full h-72 bg-cover bg-center" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuBkkrggSjdqmDx-c-tO9DeiJSy-aMmu5AKrjwZ_BzTaM_7ingI1S_MP8DQ98J3_35gG2jHGp5T-MvJzklEsrRh9-Wp8HNIbnpy0pkOARE9oOMVL_YpyFIxXBJGTniAPUfDF8ALOV59fjAhnwtl3QxgIpZ2K4G3yFplW6mtWpi_zKH0Yumpb-AjP67vMaoUUMyBrn_I777VrDTUcMH1rtK5es0GIGrCrXJlJ_oYVTONJ2dF4ACdOe2ep')">
          <div class="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-transparent"></div>
          <div class="absolute inset-0 bg-gradient-to-r from-surface via-transparent to-surface/80"></div>
        </div>

        <div class="max-w-[1440px] mx-auto px-6 -mt-24 relative z-10 pb-6">
          <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6">
            <div class="flex flex-col sm:flex-row items-start sm:items-end gap-6">
              <div class="relative group">
                <div class="w-28 h-28 rounded-xl bg-surface-container-low overflow-hidden shadow-2xl p-1 bg-gradient-to-b from-primary/30 to-surface-container-high">
                  <img class="w-full h-full object-cover rounded-lg" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWrfE0AOaM03c5tOYcdAEqxWfiddvBJIqHkTjerQgV5BzXtEWM2QcFB_yXqIBUI5k5KT_mdInFh6184tTvVIsYM5MF9ziJAn1wZFZspx0TDOYesod6Ytugpzs3qTQCJRPso98Ri-1-66Rq14gbIF56SIbmCjNx5ec4NocOXUcgETskeBgNexTXcgDzEfFQqGYVWzXx9-7oeBKevqeceOQHo90_jC5eG_QupLi-0s-HfruE3M0XVO2k" onerror="this.src='https://placehold.co/112x112/191c25/39c6a5?text=SCAN'">
                </div>
                <span class="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-primary text-on-primary font-bold text-[11px] shadow-md flex items-center gap-1">
                  <span class="material-symbols-outlined text-[13px]">verified</span> SCAN
                </span>
              </div>

              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-3">
                  <h1 class="text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight">${escapeHtml(currentScan.name)}</h1>
                  <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-xs font-bold shadow-sm">
                    <span class="material-symbols-outlined text-[15px]" style="font-variation-settings: 'FILL' 1;">workspace_premium</span>
                    Grupo Partner Oficial
                  </span>
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary text-xs font-semibold">
                    <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Servidor Activo #04
                  </span>
                </div>
                <p class="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
                  Colectivo dedicado a la traducción, limpieza y rotulación de alta precisión para manhuas de cultivo y manhwas de acción. Distribución autorizada con preservación de fidelidad cromática.
                </p>
              </div>
            </div>

            <!-- Botones de Acción de Scan -->
            <div class="flex flex-wrap items-center gap-2.5">
              <button class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-bold text-xs hover:bg-primary-fixed transition-all shadow-lg shadow-primary/10" onclick="document.getElementById('quick-upload-card')?.scrollIntoView({ behavior: 'smooth' })">
                <span class="material-symbols-outlined text-base">upload_file</span>
                + Subir Nuevo Capítulo
              </button>
              <a href="#works" class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-surface-container text-on-surface font-semibold text-xs hover:bg-surface-container-high transition-all">
                <span class="material-symbols-outlined text-base">library_books</span>
                Gestionar Obras
              </a>
              <button class="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-all" title="Invitar Colaborador" onclick="alert('Enlace de invitación generado para nuevos editores.')">
                <span class="material-symbols-outlined text-base">person_add</span>
              </button>
            </div>
          </div>

          <!-- Métricas del Grupo -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div class="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-center justify-between border border-[#232733]">
              <div>
                <p class="text-[11px] font-bold text-outline uppercase tracking-wider">Series Activas</p>
                <p class="text-2xl font-bold text-on-surface mt-1">${currentScan.active_series}</p>
                <span class="text-xs text-primary flex items-center gap-1 mt-0.5">
                  <span class="material-symbols-outlined text-xs">trending_up</span> 2 en simulpub
                </span>
              </div>
              <div class="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-2xl">auto_stories</span>
              </div>
            </div>

            <div class="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-center justify-between border border-[#232733]">
              <div>
                <p class="text-[11px] font-bold text-outline uppercase tracking-wider">Capítulos Totales</p>
                <p class="text-2xl font-bold text-on-surface mt-1">${currentScan.total_chapters}</p>
                <span class="text-xs text-on-surface-variant mt-0.5">+14 este mes</span>
              </div>
              <div class="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center text-tertiary">
                <span class="material-symbols-outlined text-2xl">collections_bookmark</span>
              </div>
            </div>

            <div class="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-center justify-between border border-[#232733]">
              <div>
                <p class="text-[11px] font-bold text-outline uppercase tracking-wider">Lecturas Acumuladas</p>
                <p class="text-2xl font-bold text-on-surface mt-1">${currentScan.accumulated_views}</p>
                <span class="text-xs text-primary flex items-center gap-1 mt-0.5">
                  <span class="material-symbols-outlined text-xs">north_east</span> +18.4% semana
                </span>
              </div>
              <div class="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-2xl">visibility</span>
              </div>
            </div>

            <div class="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-center justify-between border border-[#232733]">
              <div>
                <p class="text-[11px] font-bold text-outline uppercase tracking-wider">Miembros Activos</p>
                <p class="text-2xl font-bold text-on-surface mt-1">${currentScan.active_members}</p>
                <span class="text-xs text-on-surface-variant mt-0.5">5 en línea ahora</span>
              </div>
              <div class="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center text-on-surface">
                <span class="material-symbols-outlined text-2xl">groups</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección Central: Pipeline Resumido + Subida Rápida -->
      <div class="max-w-[1440px] mx-auto px-6 py-6 w-full space-y-8">
        <!-- Pipeline Preview -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-2.5 h-6 rounded bg-primary"></div>
              <h2 class="text-lg font-bold text-on-surface">Pipeline de Producción en Vivo</h2>
              <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs">5 en cola</span>
            </div>
            <a href="#pipeline" class="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
              Ver Pipeline Completo →
            </a>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Pipeline Card 1 -->
            <div class="p-4 rounded-xl bg-surface-container-low border border-[#232733] space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="px-2 py-0.5 rounded bg-surface-container text-outline text-[10px] font-bold">MANHUA • ACCIÓN</span>
                  <h3 class="text-sm font-bold text-on-surface mt-1">Cap. 85 El Emperador de la Espada</h3>
                  <p class="text-[11px] text-on-surface-variant">Prioridad: Alta • Hoy 22:00 UTC</p>
                </div>
                <span class="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs animate-spin">sync</span> En Proceso
                </span>
              </div>
              <div class="space-y-1">
                <div class="flex justify-between text-xs text-on-surface-variant">
                  <span>Progreso de Tareas</span>
                  <span class="text-primary font-bold">42%</span>
                </div>
                <div class="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div class="h-full bg-primary rounded-full" style="width: 42%;"></div>
                </div>
              </div>
              <div class="flex items-center justify-between pt-1 text-xs text-on-surface-variant">
                <span>Turno: <strong class="text-white">RedrawerKidd</strong> (18/26 pags)</span>
                <button class="text-primary hover:underline text-[11px]" onclick="alert('Abriendo galería de revisión de PSDs.')">Revisar PSD</button>
              </div>
            </div>

            <!-- Pipeline Card 2 -->
            <div class="p-4 rounded-xl bg-surface-container-low border border-[#232733] space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="px-2 py-0.5 rounded bg-surface-container text-outline text-[10px] font-bold">MANHWA • FANTASÍA</span>
                  <h3 class="text-sm font-bold text-on-surface mt-1">Cap. 120 Monarca de las Sombras</h3>
                  <p class="text-[11px] text-on-surface-variant">Prioridad: Crítica • 48 páginas Webtoon HD</p>
                </div>
                <span class="px-2 py-0.5 rounded bg-tertiary/20 text-tertiary text-[10px] font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">stars</span> QC Aprobado
                </span>
              </div>
              <div class="space-y-1">
                <div class="flex justify-between text-xs text-on-surface-variant">
                  <span>Validación de Calidad</span>
                  <span class="text-tertiary font-bold">100%</span>
                </div>
                <div class="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div class="h-full bg-tertiary rounded-full" style="width: 100%;"></div>
                </div>
              </div>
              <div class="flex items-center justify-between pt-1 text-xs">
                <span class="text-outline">Listo para publicación</span>
                <button class="px-2.5 py-1 rounded bg-primary text-black font-bold text-xs" onclick="alert('¡Capítulo publicado y notificado a los seguidores!')">Publicar Ahora</button>
              </div>
            </div>

            <!-- Pipeline Card 3 -->
            <div class="p-4 rounded-xl bg-surface-container-low border border-[#232733] space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="px-2 py-0.5 rounded bg-surface-container text-outline text-[10px] font-bold">MANHUA • REENCARNACIÓN</span>
                  <h3 class="text-sm font-bold text-on-surface mt-1">Cap. 63 Regreso del Fénix Inmortal</h3>
                  <p class="text-[11px] text-on-surface-variant">Prioridad: Media • Revisión de Raw HD</p>
                </div>
                <span class="px-2 py-0.5 rounded bg-tertiary/15 text-tertiary text-[10px] font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">draw</span> Typeset Activo
                </span>
              </div>
              <div class="space-y-1">
                <div class="flex justify-between text-xs text-on-surface-variant">
                  <span>Rotulado & SFX</span>
                  <span class="text-tertiary font-bold">78%</span>
                </div>
                <div class="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div class="h-full bg-tertiary rounded-full" style="width: 78%;"></div>
                </div>
              </div>
              <div class="flex items-center justify-between pt-1 text-xs text-on-surface-variant">
                <span>Turno: <strong class="text-white">FontMaster_V</strong> (19/24)</span>
                <button class="text-tertiary hover:underline text-[11px]" onclick="alert('Abriendo editor de diálogos.')">Ver Diálogos</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Subida Rápida de Capítulos (ZIP) -->
        <section class="p-6 rounded-2xl bg-surface-container-low border border-[#232733] space-y-4" id="quick-upload-card">
          <div class="flex items-center justify-between pb-3 border-b border-[#282e3b]/50">
            <div>
              <h2 class="text-lg font-bold text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">cloud_upload</span> Subida Rápida de Capítulos (.ZIP)
              </h2>
              <p class="text-xs text-outline">Carga directa con optimización automática a WebP y distribución CDN</p>
            </div>
          </div>

          <form id="quick-upload-form" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-semibold text-on-surface-variant mb-1">Serie Destino</label>
                <select class="w-full h-10 px-3 bg-surface-container rounded-lg text-white text-xs border border-[#282e3b] focus:outline-none focus:border-primary">
                  <option>El Emperador de la Espada (Manhua)</option>
                  <option>Monarca de las Sombras (Manhwa)</option>
                  <option>Regreso del Fénix Inmortal (Manhua)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-on-surface-variant mb-1">Nº de Capítulo</label>
                <input class="w-full h-10 px-3 bg-surface-container rounded-lg text-white text-xs border border-[#282e3b] focus:outline-none focus:border-primary" type="number" value="85" step="0.5">
              </div>
              <div>
                <label class="block text-xs font-semibold text-on-surface-variant mb-1">Título del Capítulo (Opcional)</label>
                <input class="w-full h-10 px-3 bg-surface-container rounded-lg text-white text-xs border border-[#282e3b] focus:outline-none focus:border-primary placeholder:text-outline" placeholder="Ej: El filo primordial" type="text">
              </div>
            </div>

            <!-- Dropzone -->
            <div class="p-6 rounded-xl bg-surface-container/60 border-2 border-dashed border-[#282e3b] hover:border-primary/60 transition-all flex flex-col items-center justify-center text-center cursor-pointer group" onclick="document.getElementById('zip-file-input').click()">
              <input type="file" id="zip-file-input" class="hidden" accept=".zip,.rar,.cbz">
              <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-2xl">folder_zip</span>
              </div>
              <p class="text-sm font-bold text-white" id="zip-upload-label">Arrastra aquí el archivo .ZIP con las imágenes numeradas</p>
              <p class="text-xs text-outline mt-1">Soporta PNG, JPEG o WebP (01.webp, 02.webp...)</p>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-4 pt-2">
              <label class="flex items-center gap-2 text-xs text-tertiary cursor-pointer">
                <input type="checkbox" class="rounded bg-surface text-tertiary focus:ring-0">
                <span>Acceso VIP Anticipado con Monedas YumeZone (3 días antes del estreno general)</span>
              </label>

              <button type="submit" class="px-6 py-2.5 rounded-lg bg-primary text-black font-bold text-xs hover:bg-primary-fixed transition-colors shadow-md flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">publish</span> Iniciar Subida y Optimización WebP
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  `;

  // Asignar evento de subida simulada
  document.getElementById('zip-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById('zip-upload-label').textContent = `Archivo seleccionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    }
  });

  document.getElementById('quick-upload-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('✅ Archivo recibido: Procesando imágenes en servidor CDN...');
  });
}

// ----------------------------------------------------
// VISTA 2: PIPELINE DETALLADO
// ----------------------------------------------------
async function renderPipelineView(root) {
  root.innerHTML = `
    <div class="px-6 lg:px-12 py-8 max-w-[1440px] mx-auto w-full space-y-6">
      <div class="flex items-center justify-between pb-4 border-b border-[#282e3b]/50">
        <div>
          <h2 class="text-xl font-bold text-on-surface">Pipeline Editorial & Control de Tareas</h2>
          <p class="text-xs text-outline mt-0.5">Seguimiento por rol: Raw Hunter ➔ Cleaner ➔ Traductor ➔ Typesetter ➔ QC Final</p>
        </div>
        <button class="px-3 py-1.5 rounded-lg bg-primary text-black font-bold text-xs" onclick="alert('Nueva tarea asignada.')">
          + Asignar Nuevo Turno
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
        <div class="p-3.5 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center justify-between font-bold text-primary">
            <span>1. Raw Hunter</span>
            <span class="material-symbols-outlined text-sm">download_done</span>
          </div>
          <p class="text-[11px] text-outline">3 raws extraídas hoy</p>
        </div>
        <div class="p-3.5 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center justify-between font-bold text-tertiary">
            <span>2. Cleaner / Redraw</span>
            <span class="material-symbols-outlined text-sm">brush</span>
          </div>
          <p class="text-[11px] text-outline">RedrawerKidd trabajando</p>
        </div>
        <div class="p-3.5 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center justify-between font-bold text-primary">
            <span>3. Traducción</span>
            <span class="material-symbols-outlined text-sm">translate</span>
          </div>
          <p class="text-[11px] text-outline">YukiTranslation al día</p>
        </div>
        <div class="p-3.5 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center justify-between font-bold text-tertiary">
            <span>4. Typesetter</span>
            <span class="material-symbols-outlined text-sm">font_download</span>
          </div>
          <p class="text-[11px] text-outline">FontMaster_V activo</p>
        </div>
        <div class="p-3.5 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center justify-between font-bold text-emerald-400">
            <span>5. QC Final</span>
            <span class="material-symbols-outlined text-sm">verified</span>
          </div>
          <p class="text-[11px] text-outline">KuroGhost listo para firmar</p>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// VISTA 3: OBRAS DEL SCAN
// ----------------------------------------------------
async function renderWorksView(root) {
  root.innerHTML = `
    <div class="px-6 lg:px-12 py-8 max-w-[1440px] mx-auto w-full">
      <div class="p-6 rounded-2xl bg-surface-container-low border border-[#232733]">
        <div class="flex items-center justify-between pb-6 border-b border-[#282e3b]/50">
          <div>
            <h2 class="text-xl font-bold text-on-surface">Catálogo de Obras Asignadas al Grupo</h2>
            <p class="text-xs text-outline mt-0.5">Series donde tu scan tiene derechos de subida autorizada</p>
          </div>
          <button class="px-3 py-1.5 rounded-lg bg-primary text-black font-bold text-xs" onclick="alert('Solicitud de adición de obra enviada.')">
            + Solicitar Nueva Serie
          </button>
        </div>

        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-surface-container text-outline uppercase tracking-wider text-[11px]">
                <th class="py-3 px-4 rounded-l-lg">Obra</th>
                <th class="py-3 px-4">Tipo</th>
                <th class="py-3 px-4">Último Cap.</th>
                <th class="py-3 px-4">Lecturas</th>
                <th class="py-3 px-4">Estado</th>
                <th class="py-3 px-4 text-right rounded-r-lg">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#282e3b]/30">
              <tr class="hover:bg-surface-container/60 transition-colors">
                <td class="py-3 px-4 font-bold text-white">El Emperador de la Espada</td>
                <td class="py-3 px-4 text-primary font-semibold">Manhua</td>
                <td class="py-3 px-4 text-white font-semibold">Cap. 84</td>
                <td class="py-3 px-4">1.2M</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">Al día</span></td>
                <td class="py-3 px-4 text-right">
                  <button class="px-2.5 py-1 rounded bg-surface-container-high text-primary hover:bg-surface-container-highest font-semibold" onclick="alert('Abriendo ficha de la obra')">Editar Ficha</button>
                </td>
              </tr>
              <tr class="hover:bg-surface-container/60 transition-colors">
                <td class="py-3 px-4 font-bold text-white">Monarca de las Sombras</td>
                <td class="py-3 px-4 text-on-surface font-semibold">Manhwa</td>
                <td class="py-3 px-4 text-white font-semibold">Cap. 119</td>
                <td class="py-3 px-4">2.4M</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">Al día</span></td>
                <td class="py-3 px-4 text-right">
                  <button class="px-2.5 py-1 rounded bg-surface-container-high text-primary hover:bg-surface-container-highest font-semibold" onclick="alert('Abriendo ficha de la obra')">Editar Ficha</button>
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
// VISTA 4: SQUAD & EQUIPO
// ----------------------------------------------------
async function renderSquadView(root) {
  root.innerHTML = `
    <div class="px-6 lg:px-12 py-8 max-w-[1440px] mx-auto w-full space-y-6">
      <div class="flex items-center justify-between pb-4 border-b border-[#282e3b]/50">
        <div>
          <h2 class="text-xl font-bold text-on-surface">Equipo de Trabajo (Scan Squad)</h2>
          <p class="text-xs text-outline mt-0.5">Integrantes, asignaciones activas y cuotas de producción mensual</p>
        </div>
        <button class="px-3 py-1.5 rounded-lg bg-primary text-black font-bold text-xs" onclick="alert('Enlace de invitación generado.')">
          + Invitar Miembro
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center font-bold text-tertiary">KG</div>
            <div>
              <p class="text-xs font-bold text-white">KuroGhost</p>
              <span class="text-[10px] text-tertiary font-bold">LÍDER & QC</span>
            </div>
          </div>
          <p class="text-[11px] text-outline">24 caps revisados este mes</p>
        </div>

        <div class="p-4 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center font-bold text-primary">YT</div>
            <div>
              <p class="text-xs font-bold text-white">YukiTranslation</p>
              <span class="text-[10px] text-primary font-bold">TRADUCTORA</span>
            </div>
          </div>
          <p class="text-[11px] text-outline">16 caps traducidos este mes</p>
        </div>

        <div class="p-4 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center font-bold text-tertiary">RK</div>
            <div>
              <p class="text-xs font-bold text-white">RedrawerKidd</p>
              <span class="text-[10px] text-tertiary font-bold">CLEANER / REDRAW</span>
            </div>
          </div>
          <p class="text-[11px] text-outline">19 caps limpiados este mes</p>
        </div>

        <div class="p-4 rounded-xl bg-surface-container-low border border-[#232733] space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center font-bold text-white">FM</div>
            <div>
              <p class="text-xs font-bold text-white">FontMaster_V</p>
              <span class="text-[10px] text-outline font-bold">TYPESETTER</span>
            </div>
          </div>
          <p class="text-[11px] text-outline">22 caps rotulados este mes</p>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// VISTA 5: FINANZAS Y FONDOS DEL SCAN
// ----------------------------------------------------
async function renderFinancesView(root) {
  root.innerHTML = `
    <div class="px-6 lg:px-12 py-8 max-w-[1440px] mx-auto w-full space-y-6">
      <div class="p-6 rounded-2xl bg-surface-container-low border border-[#232733] space-y-4">
        <div class="flex items-center justify-between pb-4 border-b border-[#282e3b]/50">
          <div>
            <h2 class="text-xl font-bold text-on-surface">Monetización & Fondo del Grupo</h2>
            <p class="text-xs text-outline mt-0.5">Ingresos por lecturas anticipadas VIP, Ko-fi y donaciones</p>
          </div>
          <button class="px-4 py-2 rounded-lg bg-primary text-black font-bold text-xs" onclick="alert('Solicitud de retiro de fondos enviada a administración.')">
            Solicitar Retiro ($1,420.00 USD)
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div class="p-4 rounded-xl bg-surface-container border border-[#282e3b]/40">
            <span class="text-xs text-outline">Monedas YumeZone (VIP)</span>
            <p class="text-2xl font-bold text-tertiary mt-1">$890.00 USD</p>
          </div>
          <div class="p-4 rounded-xl bg-surface-container border border-[#282e3b]/40">
            <span class="text-xs text-outline">Donaciones Patreon / Ko-fi</span>
            <p class="text-2xl font-bold text-secondary mt-1">$410.00 USD</p>
          </div>
          <div class="p-4 rounded-xl bg-surface-container border border-[#282e3b]/40">
            <span class="text-xs text-outline">Anuncios Optativos</span>
            <p class="text-2xl font-bold text-primary mt-1">$120.00 USD</p>
          </div>
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
