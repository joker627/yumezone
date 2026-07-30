# manhwav7

Base limpia y ordenada para crecer desde cero.

## Objetivo

Separar claramente el frontend y el backend desde el principio para evitar mezclar responsabilidades.

## Estructura base

- `frontend/` para la interfaz, componentes visuales, estilos, páginas y recursos estáticos.
- `backend/` para la API, modelos, repositorios, servicios, configuración y tests.
- `docs/` para documentación de arquitectura, decisiones y notas de aprendizaje.
- `scripts/` para utilidades de mantenimiento o automatización.

## Subestructura recomendada

- En `frontend/`, separar `components`, `pages`, `services`, `styles`, `assets` y `tests`.
- En `backend/`, separar `api`, `core`, `database`, `models`, `repository`, `schemas`, `services` y `tests`.
- En `docs/`, separar arquitectura y ruta de aprendizaje.

## Regla simple

- El frontend no debe contener lógica de servidor.
- El backend no debe contener código de presentación.
- La documentación debe explicar el porqué de cada carpeta, no solo listar archivos.

## Inicio recomendado

1. Empieza por una sola funcionalidad pequeña.
2. Define la ruta en backend.
3. Conecta el frontend solo a esa ruta.
4. Documenta la decisión en `docs/`.

## Aprendizaje

La ruta recomendada está en [docs/roadmap/learning-path.md](docs/roadmap/learning-path.md).
