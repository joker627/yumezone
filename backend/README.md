# 📚 YumeZone Backend

Núcleo de **YumeZone**, construido con **FastAPI**, **SQLAlchemy 2.0 Async** y **PostgreSQL (`asyncpg`)** siguiendo una arquitectura **Vertical Slice (Modular Monolith)**.

---

## 🏛️ Estructura del Proyecto (`backend/`)

```text
backend/
├── requirements.txt             # Dependencias (FastAPI, SQLAlchemy 2.0 Async, asyncpg, Redis)
├── sql/
│   ├── schema.sql               # Esquema nativo PostgreSQL 15+ (40 tablas, índices y seeds base)
│   └── mock.sql                 # Datos de prueba para desarrollo local
└── app/
    ├── main.py                  # Punto de entrada FastAPI, middlewares y registro de rutas (/api/v1)
    ├── core/                    # Configuración del servidor y seguridad transversal
    │   ├── config.py            # Variables de entorno y construcción de DATABASE_URL
    │   ├── dependencies.py      # Autenticación JWT, verificación de sesiones y permisos RBAC
    │   └── security.py          # Hashing bcrypt y firma/validación JWT
    ├── db/                      # Capa de almacenamiento y persistencia (PostgreSQL + Redis)
    │   ├── base.py              # DeclarativeBase central con serialización .to_dict()
    │   ├── models.py            # Registro centralizado de metadatos ORM de todos los módulos
    │   ├── redis.py             # Conexión Redis, decorador @cached_query y rate-limiting
    │   └── session.py           # AsyncEngine, get_db_session, resolve_session y transaction_scope
    ├── modules/                 # Módulos verticales autocontenidos (Vertical Slices)
    │   ├── admin/               # Panel de control, auditoría, configuración y métricas de lectura
    │   │   ├── models.py        # Tablas: view_logs, audit_logs, platform_settings, content_reports
    │   │   ├── repository.py
    │   │   ├── router.py        # Endpoints /api/v1/admin y /api/v1/metrics
    │   │   ├── schemas.py
    │   │   └── services.py
    │   ├── auth/                # Login, registro, recuperación y tokens JWT
    │   │   ├── repository.py
    │   │   ├── router.py
    │   │   ├── schemas.py
    │   │   └── services.py
    │   ├── chapters/            # Capítulos, páginas y entregas de traducción
    │   │   ├── models.py        # Tablas: chapters, chapter_images, chapter_submissions
    │   │   ├── repository.py
    │   │   ├── router.py
    │   │   ├── schemas.py
    │   │   └── services.py
    │   ├── comments/            # Comentarios y reacciones en series y capítulos
    │   │   ├── models.py        # Tablas: comments, comment_reactions
    │   │   ├── repository.py
    │   │   ├── router.py
    │   │   ├── schemas.py
    │   │   └── services.py
    │   ├── home/                # Portada, Hero carrusel, rankings, avisos y misiones
    │   │   ├── models.py        # Tablas: hero_queue, announcements
    │   │   ├── repository.py
    │   │   ├── router.py        # Endpoints /api/v1/home, /api/v1/hero y /api/v1/announcements
    │   │   ├── schemas.py
    │   │   └── services.py
    │   ├── notifications/       # Alertas de nuevos capítulos, respuestas y clanes
    │   │   ├── models.py        # Tabla: notifications
    │   │   ├── repository.py
    │   │   ├── router.py
    │   │   └── services.py
    │   ├── scans/               # Clanes Scanlator, miembros, roles, bóveda y metas
    │   │   ├── models.py        # Tablas: scan_groups, scan_roles, scan_group_members, etc.
    │   │   ├── repository.py
    │   │   ├── router.py
    │   │   ├── schemas.py
    │   │   └── services.py
    │   ├── series/              # Mangas/Manhwas/Webtoons, géneros, formatos y estadísticas
    │   │   ├── models.py        # Tablas: works, statuses, formats, demographics, genres, tags, etc.
    │   │   ├── repository.py
    │   │   ├── router.py        # Endpoints /api/v1/works y alias /api/v1/series
    │   │   ├── schemas.py
    │   │   └── services.py
    │   ├── shop/                # Tienda de cosméticos, inventario y misiones diarias
    │   │   ├── models.py        # Tablas: shop_items, user_inventory, daily_missions, etc.
    │   │   ├── repository.py
    │   │   ├── router.py
    │   │   ├── schemas.py
    │   │   └── services.py
    │   ├── uploads/             # Subida y validación física de imágenes
    │   │   ├── router.py
    │   │   └── services.py
    │   └── users/               # Perfiles, roles, rangos de cultivo y biblioteca personal
    │       ├── models.py        # Tablas: users, roles, user_library, reading_history, etc.
    │       ├── repository.py
    │       ├── router.py        # Endpoints /api/v1/users y /api/v1/library
    │       ├── schemas.py
    │       └── services.py
    └── utils/                   # Utilidades puras
        ├── formatters.py        # Slugs, formato de vistas, números de capítulo y tiempo relativo
        └── network.py           # Extracción segura de IP del cliente
```
