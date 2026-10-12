from decimal import Decimal
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator
from datetime import datetime


# ESQUEMAS PARA IMÁGENES
class ChapterImageResponse(BaseModel):
    id: int
    chapter_id: int
    image_url: str
    order_number: int


class ChapterPageReference(BaseModel):
    """Referencia de una página alojada fuera de esta API.

    La API no recibe ni persiste binarios. ``image_url`` puede ser una URL HTTPS
    (por ejemplo, Azure Blob/CDN) o una ruta relativa resuelta por el frontend.
    """

    image_url: Annotated[str, Field(min_length=1, max_length=1024)]
    order_number: Annotated[int, Field(ge=1)]

    @field_validator("image_url")
    @classmethod
    def validate_image_reference(cls, value: str) -> str:
        value = value.strip()
        if not (value.startswith("https://") or (value.startswith("/") and not value.startswith("//"))):
            raise ValueError("image_url debe ser una URL HTTPS o una ruta absoluta")
        return value


class ChapterPagesReplace(BaseModel):
    pages: list[ChapterPageReference] = Field(min_length=1, max_length=500)


# ESQUEMAS PARA CAPÍTULOS
class ChapterCreate(BaseModel):
    work_id: int
    chapter_number: Annotated[Decimal, Field(max_digits=6, decimal_places=2, ge=0)]
    title: Optional[str] = Field(default=None, max_length=255)
    scan_group_id: Optional[int] = None


class ChapterUpdate(BaseModel):
    chapter_number: Optional[Annotated[Decimal, Field(max_digits=6, decimal_places=2, ge=0)]] = None
    title: Optional[str] = Field(default=None, max_length=255)
    scan_group_id: Optional[int] = None
    status: Optional[Literal["DRAFT", "PUBLISHED", "SCHEDULED", "HIDDEN"]] = None


class ChapterResponse(BaseModel):
    id: int
    work_id: int
    scan_group_id: Optional[int] = None
    chapter_number: Decimal
    title: Optional[str] = None
    slug: str
    status: str
    published_at: Optional[datetime] = None

    # Lista de imágenes vinculadas al capítulo
    images: Optional[list[ChapterImageResponse]] = []
