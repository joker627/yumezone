from datetime import datetime, timezone, timedelta
import json
from typing import Any, Optional


def format_chapter_number(chapter_number: Any) -> str:
    """Formatea números de capítulo eliminando decimales innecesarios."""
    if chapter_number is None:
        return ""

    try:
        cn = float(chapter_number)
        return str(int(cn)) if cn.is_integer() else str(cn).rstrip("0").rstrip(".")
    except (ValueError, TypeError):
        return str(chapter_number)


def format_views(views: int) -> str:
    """Formatea vistas en formato legible."""
    views = int(views or 0)

    if views >= 1_000_000:
        return f"{views / 1_000_000:.1f}M lecturas"

    if views >= 1_000:
        return f"{views / 1_000:.0f}k lecturas"

    if views == 1:
        return "1 lectura"

    return f"{views} lecturas"


def format_relative_time(dt: Optional[datetime]) -> str:
    """Calcula tiempo relativo legible."""
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

    # Día anterior
    if dt.date() == now.date() - timedelta(days=1):
        return "Ayer"

    days = (now.date() - dt.date()).days

    if days < 7:
        return f"Hace {days}d"

    return dt.strftime("%d/%m/%Y")


def parse_json_safe(value: Any, default: Any = None) -> Any:
    """Parsea JSON de forma segura."""
    if value is None:
        return default

    if isinstance(value, (dict, list)):
        return value

    try:
        return json.loads(value)
    except Exception:
        return default