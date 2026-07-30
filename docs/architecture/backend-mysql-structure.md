# Arquitectura Modular del Backend (Domain-Driven)

Este proyecto utiliza una arquitectura modular (también conocida como arquitectura orientada a dominios). En lugar de organizar los archivos por su tipo (todos los schemas juntos, todos los repositorios juntos), se organizan por la **funcionalidad** o **dominio** que representan.

## Estructura de Carpetas

```text
app/
├── api/             # Capa de presentación principal
│   └── v1/
│       ├── api.py   # Registro central de todos los routers de los módulos
│       └── endpoints/
│           └── health.py # Endpoint básico de estado del servidor
├── core/            # Configuración, Seguridad y Base de Datos
│   ├── database.py  # Conexión principal a MySQL (Pool)
│   └── security.py  # Funciones de Hashing, JWT y dependencias (get_current_user)
└── modules/         # Módulos de la aplicación (Dominios)
    ├── chapters/    # Todo lo relacionado a los Capítulos de un Manga
    ├── mangas/      # Todo lo relacionado a la entidad principal Manga
    ├── pages/       # Gestión de las páginas/imágenes de los capítulos
    └── users/       # Autenticación, Registro y Perfiles de Usuarios
```

## ¿Qué hace cada archivo dentro de un Módulo?

Cada carpeta dentro de `modules/` (ej. `mangas/`, `users/`) es completamente independiente y contiene tres archivos principales:

1. **`router.py` (Endpoints)**
   - **Qué hace:** Es la puerta de entrada. Recibe las peticiones HTTP (GET, POST, PUT, DELETE), valida los parámetros y devuelve la respuesta.
   - **Regla:** No debe tener lógica pesada ni escribir código SQL directamente. Solo llama al Repositorio.

2. **`schemas.py` (Modelos Pydantic)**
   - **Qué hace:** Define la forma de los datos que entran y salen. Valida tipos de datos, longitudes, formatos (ej. que un email sea válido).
   - **Regla:** Se definen los Request (lo que envía el Frontend) y los Response (lo que devuelve el Backend).

3. **`repository.py` (Acceso a Datos / SQL)**
   - **Qué hace:** Se encarga exclusivamente de hablar con MySQL usando `aiomysql`.
   - **Regla:** Aquí viven todas las sentencias `SELECT`, `INSERT`, `UPDATE`, `DELETE`. Recibe datos limpios del router y ejecuta el SQL crudo. Sin usar ORMs.

## Flujo de una Petición (Ejemplo: Crear un Manga)

1. El Frontend envía un `POST /mangas/` con un JSON.
2. FastAPI intercepta la petición y usa **`schemas.py` (`MangaCreateRequest`)** para verificar que el JSON tenga todos los campos requeridos y correctos.
3. El **`router.py`** recibe los datos validados y, si la ruta está protegida, verifica en `core/security.py` que el token JWT sea válido.
4. El **`router.py`** llama a **`repository.py` (`MangaRepository.create_manga`)** pasándole la conexión a la base de datos y los datos.
5. El **`repository.py`** ejecuta el `INSERT INTO mangas...`, hace el `commit()` y devuelve el ID generado.
6. El **`router.py`** responde al Frontend con un mensaje de éxito y el nuevo ID.

## Reglas de Implementación

- **Modularidad:** Si necesitas crear un sistema de "Comentarios", debes crear una nueva carpeta `app/modules/comments/` con sus 3 archivos. No mezcles cosas.
- **Inyección de Dependencias:** Siempre pasa la conexión de la base de datos (`pool`) desde el router hacia el repositorio.
- **SQL Crudo Seguro:** Siempre utiliza consultas parametrizadas (`%s`) en `aiomysql` para evitar inyecciones SQL.
