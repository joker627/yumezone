# 📚 Documentación de YumeZone

## 🏛️ Arquitectura del Sistema
YumeZone sigue una arquitectura basada en **Domain-Driven Design (DDD)** simplificado. Todo está separado en módulos de negocio.

### Flujo de Datos Backend
La estructura de cada módulo backend (en `backend/app/modules/`) sigue este patrón de capas:
1. **`router.py`**: Interfaz HTTP. Recibe validaciones de entrada vía Pydantic.
2. **`schemas.py`**: Modelos Pydantic para validar Request y Response DTOs.
3. **`services.py`**: Contiene toda la lógica de negocio.
4. **`repository.py`**: Encargado exclusivamente de las interacciones con la base de datos usando SQL crudo con `aiomysql`.
5. **`models.py`**: Opcional, para representaciones en memoria.

### Principios de Calidad de Código
- **Separación de Responsabilidades:** El router jamás ejecuta consultas SQL directas.
- **SOLID & DRY:** Las dependencias se inyectan en los endpoints para facilitar testing. Lógica reutilizable va a los servicios.
- **Manejo de Errores:** Errores de BD se atrapan en el repositorio o el servicio y se lanzan como excepciones HTTP estandarizadas en FastAPI.

## 🛠️ Herramientas
- **FastAPI** para la API de alto rendimiento.
- **Uvicorn** como servidor ASGI.
- **aiomysql** para consultas asíncronas no bloqueantes.

## 🔄 Flujo de Integración
Al implementar nuevas funcionalidades:
1. Validar el modelo en DB y hacer migración.
2. Crear/Actualizar `repository.py` (SQL puro).
3. Escribir lógica de negocio en `services.py`.
4. Definir validaciones en `schemas.py`.
5. Exponer a través de `router.py`.
