import json
import re
from datetime import datetime, timedelta
from typing import Any, Optional


# generar slug valido para urls (ej: 'Solo Leveling!' -> 'solo-leveling')
def generate_slug(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


# formatear numero de capitulo eliminando decimales innecesarios
def format_chapter_number(chapter_number: Any) -> str:
    if chapter_number is None:
        return ""

    try:
        cn = float(chapter_number)
        return f"{cn:.1f}"
    except (ValueError, TypeError):
        return str(chapter_number)


# formatear vistas en formato legible (k, M)
def format_views(views: int) -> str:
    views = int(views or 0)

    if views >= 1_000_000:
        return f"{views / 1_000_000:.1f}M lecturas"

    if views >= 1_000:
        return f"{views / 1_000:.0f}k lecturas"

    if views == 1:
        return "1 lectura"

    return f"{views} lecturas"


# calcular tiempo relativo legible
def format_relative_time(dt: Optional[datetime]) -> str:
    if dt is None:
        return ""

    now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
    delta = now - dt

    secs = max(0, int(delta.total_seconds()))

    if secs < 60:
        return "Ahora"

    if secs < 3600:
        return f"Hace {secs // 60}m"

    # Hoy
    if dt.date() == now.date():
        return f"Hace {secs // 3600}h"

    # Dia anterior
    if dt.date() == now.date() - timedelta(days=1):
        return "Ayer"

    days = (now.date() - dt.date()).days

    if days < 7:
        return f"Hace {days}d"

    return dt.strftime("%d/%m/%Y")


# parsear json de forma segura con valor por defecto
def parse_json_safe(value: Any, default: Any = None) -> Any:
    if value is None:
        return default

    if isinstance(value, (dict, list)):
        return value

    try:
        return json.loads(value)
    except Exception:
        return default