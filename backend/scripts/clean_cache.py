import os
import shutil
from pathlib import Path

def clean_cache():
    # Directorio base (la carpeta backend)
    base_dir = Path(__file__).resolve().parent
    
    # Directorios de caché generados habitualmente
    cache_dirs = ['__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache']
    
    # Extensiones de archivos compilados
    cache_files = ['*.pyc', '*.pyo', '*.pyd']
    
    print(f"Iniciando limpieza de caché en: {base_dir}")
    
    # Eliminar carpetas de caché
    for cache_dir in cache_dirs:
        for p in base_dir.rglob(cache_dir):
            if p.is_dir():
                try:
                    shutil.rmtree(p)
                    print(f"Eliminado directorio: {p}")
                except Exception as e:
                    print(f"Error al eliminar {p}: {e}")
                    
    # Eliminar archivos huérfanos
    for cache_file in cache_files:
        for p in base_dir.rglob(cache_file):
            if p.is_file():
                try:
                    p.unlink()
                    print(f"Eliminado archivo: {p}")
                except Exception as e:
                    print(f"Error al eliminar {p}: {e}")

    print("Limpieza de caché completada con éxito.")

if __name__ == "__main__":
    clean_cache()
