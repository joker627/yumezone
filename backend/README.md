# 📚 YumeZone Backend

Este es el núcleo de YumeZone, construido con **FastAPI** y **Raw SQL (aiomysql)** siguiendo los principios de **Domain-Driven Design (DDD)** (Diseño Orientado al Dominio).

Nuestra arquitectura modular está diseñada para ser extremadamente rápida, escalable y prevenir "códigos espagueti". Cada módulo funciona como un "mini-proyecto" independiente.

---

## 🏛️ El Mapa de Módulos (`app/modules/`)

Aquí están los dominios exclusivos de la plataforma. 
**Regla de Oro para evitar referencias circulares:** Un módulo nunca debe hacer consultas directas a la tabla de otro módulo en SQL. Si `works` necesita datos de `users`, debe llamar a las funciones del archivo `services.py` de `users`.

* 🔐 **`auth`**: Seguridad, login, registro, tokens JWT y encriptado de contraseñas.
* 👤 **`users`**: Registro de usuarios y configuraciones globales.
  * `profile/`: Edición de biografía, avatar y privacidad.
  * `followers/`: Sistema para seguir/dejar de seguir a otros usuarios.
  * `settings/`: Configuraciones del lector (modo oscuro, paginado).
* 👥 **`scans`**: Gestión de grupos scan.
  * `core/`: Crear/editar la info principal del grupo (banner, nombre).
  * `members/`: Administrar permisos, ascender/expulsar administradores.
  * `invitations/`: Aceptar o rechazar invitaciones al grupo.
* 📚 **`works`**: Gestión principal de obras.
  * `metadata/`: Portadas, actualización de estados (emisión, finalizado), etc.
* 📄 **`chapters`**: Gestión de capítulos.
  * `images/`: Lógica para subir, censurar o aislar el orden de páginas.
* ❤️ **`library`**: Todo lo personal del usuario en un solo lugar.
  * `bookmarks/`: Listas del usuario (favoritos, leyendo, completados).
  * `history/`: Historial para guardar y consultar la última página leída.
* 💬 **`comments`**: Comentarios de obras y capítulos.
  * `reactions/`: Sistema de likes/dislikes a comentarios y control de spoilers.
* 📢 **`boards`**: Tablones de anuncios.
  * `general/`: Avisos globales de Yumezone.
  * `scans/`: Tablones internos y reclutamientos de cada grupo.
* 💬 **`chat`**: El chat global en tiempo real para la comunidad.
* 🔔 **`notifications`**: El sistema de alertas (invitaciones a grupos, nuevos capítulos de favoritos).
* 🏷️ **`taxonomies`**: Para gestionar y filtrar géneros, demografías, formatos y etiquetas.
* 📊 **`statistics`**: Para inyectar vistas (view_logs) de forma asíncrona, llevar contadores y armar Rankings.

---

## ⚙️ La Anatomía Interna de un Módulo

Dentro de cada carpeta de módulo, siempre encontrarás los mismos 4 pilares:

1. 🛡️ **`schemas.py` (La Aduana):** Usa *Pydantic*. Valida los datos JSON que envía el frontend. Si falta un campo o el tipo de dato es incorrecto, bloquea la petición automáticamente.
2. 🛣️ **`router.py` (El Recepcionista):** Define las rutas de la API (Ej. `GET /works`). Recibe la petición de internet y se la pasa al Servicio.
3. 🧠 **`services.py` (El Cerebro):** Aquí vive la **lógica de negocio**. Valida permisos de usuario, formatea datos, procesa lógica antes de guardar.
4. 💾 **`repository.py` (El Obrero):** El único archivo que sabe de Base de Datos. Contiene **SQL puro** asíncrono para ejecutar los `INSERT`, `SELECT`, `UPDATE` o `DELETE`.

---

## 🚀 reglas que debo tener en cuenta para: Prevención de Cuellos de Botella

Para asegurar que Yumezone soporte miles de usuarios simultáneos sin caerse, el código debe seguir estas normas estrictas:

1. **Cero Dependencias Circulares:** Mantén la lógica aislada. Las dependencias transversales se resuelven a nivel de *Servicios*, nunca a nivel de Repositorios (SQL) ni Modelos.
2. **Cero Bloqueos (Non-Blocking):** Al usar `aiomysql`, absolutamente todas las llamadas al repositorio deben usar la palabra clave `await`. Nunca uses librerías síncronas que detengan el "Event Loop" de FastAPI.
3. **Escalabilidad de Vistas (View Logs):** Nunca hagas un `UPDATE works SET views = views + 1` en vivo cada que alguien entra. Eso bloquearía la base de datos entera. Las vistas se insertan crudas en `view_logs` (módulo `statistics`) y un proceso secundario actualiza los totales.
4. **Almacenamiento Físico:** Las imágenes nunca tocan la base de datos. Se guardan en la carpeta física `/uploads` (o un bucket como S3), y la DB solo almacena la URL en modo texto.
