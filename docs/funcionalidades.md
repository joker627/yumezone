# 📚 YumeZone Backend

Este es el núcleo de YumeZone, construido con **FastAPI** y **Raw SQL (aiomysql)** siguiendo un patrón **Router-Service-Repository**, orientado a rendimiento y simplicidad. No usamos ORMs (como SQLAlchemy o Tortoise) para mantener el control absoluto sobre las consultas SQL y su optimización.

Nuestra arquitectura modular está diseñada para ser rápida, escalable y prevenir "códigos espagueti". Cada módulo agrupa su lógica de negocio de manera independiente.

---

## 🏛️ El Mapa de Módulos (`app/modules/`)

Aquí están los dominios de la plataforma, marcados con su estado real de implementación:
✅ **Implementado y en uso** | 🚧 **Reservado / En desarrollo (Stubs o Vacíos)**

* ✅ **`auth`**: Seguridad, login, registro, `/me` y validación de tokens JWT.
* ✅ **`users`**: Modelos principales de usuario y perfil.
  * 🚧 *`profile/`*: (Edición avanzada)
  * 🚧 *`followers/`*: Sistema para seguir/dejar de seguir a otros usuarios.
  * 🚧 *`settings/`*: Configuraciones del lector.
* ✅ **`works`**: Catálogo, detalle y búsqueda principal de obras.
* ✅ **`chapters`**: Lectura y obtención de páginas de capítulos. Uploads de imágenes.
* ✅ **`library`**: Estantería personal del usuario (siguiendo, leyendo).
* ✅ **`scans`**: Gestión básica de grupos scan (CRUD).
* ✅ **`home`**: Datos para la portada (lanzamientos, ranking, populares, chat reciente, misión).
* ✅ **`hero`**: Carrusel destacado de la portada.
* 🚧 **`comments`**: Sistema de comentarios de obras y capítulos (Módulo reservado).
* 💬 **`chat (Discord WidgetBot)`**: Chat comunitario en vivo integrado directamente con Discord mediante WidgetBot, sin consumo de base de datos ni carga en el servidor backend.
* 🚧 **`boards`**: Tablones de anuncios de scans y avisos globales.
* 🚧 **`notifications`**: Sistema de alertas (invitaciones, nuevos capítulos).
* 🚧 **`taxonomies`**: Filtros de géneros, demografías y formatos (Solo modelos/tablas).
* ✅ **`statistics` / `metrics`**: Actualización de contadores de vistas y rankings mediante jobs o llamadas explícitas.

**Regla de Oro para evitar referencias circulares:** Un módulo nunca debe hacer consultas directas a la tabla de otro módulo en SQL. Si `works` necesita datos, llama al repositorio, pero para la lógica, se integran en el Service.

---

## ⚙️ La Anatomía Interna de un Módulo

Dentro de cada módulo implementado, encontrarás estos pilares:

1. 🛡️ **`schemas.py` (La Aduana):** Usa *Pydantic*. Valida los datos JSON de entrada y salida. Bloquea peticiones incorrectas.
2. 🛣️ **`router.py` (El Recepcionista):** Define las rutas de FastAPI (`GET /api/v1/works`). Recibe la petición, inyecta dependencias y la pasa.
3. 🧠 **`services.py` / Lógica:** Lógica de negocio, como guardar imágenes o calcular estados. (Algunos módulos pasan directo de router a repository si son simples).
4. 💾 **`repository.py` (El Obrero):** El único lugar donde existe **SQL puro**. Ejecuta `INSERT`, `SELECT`, `UPDATE` o `DELETE` usando `aiomysql`.
5. 🗃️ **`models.py` (Opcional):** Estructuras internas o representaciones de la BD (como `CurrentUser`).

---

## 🚀 Análisis Experto: Prevención de Cuellos de Botella

Para asegurar que Yumezone soporte tráfico alto:

1. **Cero Dependencias Circulares:** Las dependencias se resuelven inyectando Repositorios en los Routers o importando Modelos, pero nunca entrelazando imports que generen ciclos.
2. **Cero Bloqueos (Non-Blocking):** Al usar `aiomysql`, absolutamente todas las llamadas a la base de datos deben usar `await`. No se bloquea el "Event Loop" de FastAPI.
3. **Escalabilidad de Vistas:** `UPDATE works SET views = views + 1` en vivo bloquearía la base de datos. Se deben usar *view_logs* para asentar registros y luego actualizar sumarios en batch.
4. **Almacenamiento Físico:** Las imágenes nunca tocan la base de datos. Se guardan en `/uploads` y la BD almacena la URL relativa.
