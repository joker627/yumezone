# 🗺️ Ruta de Aprendizaje (Learning Path)

En este documento guardo mi progreso, recursos y notas sobre las tecnologías clave que estoy utilizando para construir **Yumezone**. El objetivo es tener una guía clara de los conceptos que he dominado y los que aún necesito profundizar.

## 🐍 Backend (Python + FastAPI)
- **FastAPI Basics**: Creación de rutas, Pydantic schemas, Dependency Injection.
- **Asincronismo**: Uso de `async`/`await` en Python, event loops.
- **Base de Datos**: 
  - Conexión cruda usando `aiomysql` (Raw SQL).
  - Buenas prácticas de consultas asíncronas para no bloquear la app.
- **Arquitectura DDD**: Separación por módulos lógicos (auth, works, chapters).
- **Seguridad**: Autenticación JWT, hasheo de contraseñas con `pwdlib`, CORS.

## 🎨 Frontend (Vainilla + CSS)
- **Arquitectura CSS**: Variables nativas, flexbox, grid, diseño responsivo y mobile-first.
- **Componentes UI**: Reutilización de fragmentos HTML mediante Javascript asíncrono (`fetch`).
- **Navegación SPA (Single Page Application)**: Manejo de historial y enrutamiento en el cliente sin frameworks.
- **Consumo de API**: Peticiones `fetch`, manejo de errores, estado de carga (skeletons).

## 🚀 Pendientes y Próximos Retos
1. Implementar la carga y optimización de imágenes (WebP/AVIF).
2. Manejo avanzado de sesiones y refresco de tokens (Refresh Tokens).
3. Websockets para el chat global y notificaciones en tiempo real.
4. Despliegue automatizado (CI/CD) usando GitHub Actions.
