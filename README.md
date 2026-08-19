# 📚 Yumezone (en desarrollo)

Plataforma de lectura digital inspirada en servicios como MangaToon y Webtoon, enfocada en **mangas, manhuas y manhwas**.  
Actualmente se encuentra en construcción, con el objetivo de ofrecer una experiencia de lectura fluida y una comunidad activa.

---

## ✨ Funcionalidades previstas
- **Gestión de obras:** Portada, sinopsis, géneros, etiquetas, autores e ilustradores.
- **Gestión de capítulos:** Creación, subida de imágenes, publicación y programación.
- **Biblioteca personal:** Favoritos, historial y continuar leyendo.
- **Descubrimiento:** Tendencias, populares, mejor valorados y recomendaciones.
- **Comunidad:** Comentarios, reacciones y chat en vivo.
- **Grupos Scan:** Equipos responsables de publicar obras, con roles y tablones internos.

## 🛠️ Tecnologías y Arquitectura

- **Frontend:** HTML/CSS/JS Vainilla - (Cloudflare Pages)
- **Backend:** FastAPI
- **Base de datos:** MySQL (aiomysql asíncrono)
- **Arquitectura:** Domain-Driven Design (DDD)

---

## 🏗️ Cómo he estructurado el desarrollo

He diseñado la arquitectura del proyecto para que sea una base limpia y ordenada, separando estrictamente las responsabilidades entre el cliente y el servidor para evitar que el código se vuelva un caos a medida que crece.

### Estructura Principal
- `frontend/`: Aquí manejo toda la interfaz de usuario, componentes visuales, estilos, páginas y recursos estáticos.
- `backend/`: Aquí vive la API, los modelos, repositorios de base de datos, servicios, configuración y pruebas.
- `docs/`: Guardo aquí la documentación de arquitectura, mis decisiones técnicas y notas de aprendizaje.
- `scripts/`: Herramientas y utilidades que he creado para el mantenimiento o automatización.

### Subestructura
- En `frontend/`, he organizado todo en `components`, `pages`, `services`, `styles`, `assets` y `tests`.
- En `backend/`, utilizo una arquitectura modular por dominios (`app/modules/`). Cada módulo es independiente y tiene su propio `router`, `schemas`, `services` y `repository`.

### Mis Principios de Diseño
Para prevenir código espagueti y acoplamiento, he establecido tres reglas fundamentales con las que trabajo:
1. En el **frontend** nunca incluyo ni simulo lógica de servidor o de base de datos.
2. En el **backend** jamás genero ni incluyo código de presentación.
3. Al documentar, siempre explico el *porqué* de cada estructura técnica, no me limito a listar los archivos.

### Mi Flujo de Trabajo
Cuando desarrollo una nueva integración, sigo este ciclo iterativo:
1. Diseño una funcionalidad delimitada y muy pequeña.
2. Implemento la ruta, la lógica y la base de datos correspondientes en el backend.
3. Consumo la API desde el frontend de manera aislada para probar esa funcionalidad.
4. Documento mis decisiones arquitectónicas en el directorio `docs/`.

---

## 🚀 Estado del proyecto

Este repositorio está en **fase inicial de desarrollo**. Voy integrando y liberando las funcionalidades progresivamente. 

Aunque el proyecto avanza, es de código abierto y siempre estoy dispuesto a recibir sugerencias y colaboración. Quien quiera aportar, puede abrir un *issue* detallando su idea o enviar un *pull request* respetando esta misma estructura.
