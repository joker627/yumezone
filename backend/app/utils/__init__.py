# exportacion centralizada de utilidades del backend
from app.utils.formatters import (
    format_chapter_number,
    format_views,
    format_relative_time,
    generate_slug,
    parse_json_safe,
    to_json_safe,
)
from app.utils.network import get_client_ip

__all__ = [
    "format_chapter_number",
    "format_views",
    "format_relative_time",
    "generate_slug",
    "parse_json_safe",
    "to_json_safe",
    "get_client_ip",
]
