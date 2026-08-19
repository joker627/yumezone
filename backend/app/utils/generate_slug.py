import re

def generate_slug(text: str) -> str:
    """
    Convierte una cadena de texto en un slug válido para URLs.
    Ejemplo: 'Solo Leveling!' -> 'solo-leveling'
    """
    slug = text.lower()
    # Reemplaza caracteres no alfanuméricos por guiones
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    # Elimina guiones al principio y al final
    return slug.strip('-')
