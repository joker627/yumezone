from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    is_platform_admin,
    verify_scan_member_permission,
    verify_upload_permission,
)
from app.modules.chapters.schemas import Chapter, ChapterImage
from app.modules.chapters.repository import (
    ChapterImageRepository,
    ChapterRepository,
)
from app.modules.chapters.schemas import (
    ChapterCreate,
    ChapterPageReference,
    ChapterSubmissionCreate,
    ChapterSubmissionReview,
)
from app.modules.scans.repository import ScanGroupRepository
from app.modules.users.schemas import CurrentUser

from app.utils.formatters import generate_slug


class ChapterService:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.chapter_repository = ChapterRepository(conn)
        self.chapter_image_repository = ChapterImageRepository(conn)
        self.scan_repo = ScanGroupRepository(conn)

    async def create_chapter(self, data: ChapterCreate) -> Chapter:
        if await self.get_chapter_by_number(data.work_id, data.chapter_number):
            raise HTTPException(status_code=409, detail="Ya existe ese número de capítulo en la obra")

        number = format(data.chapter_number.normalize(), "f").replace(".", "-")
        chapter = Chapter(
            **data.model_dump(),
            slug=generate_slug(f"work-{data.work_id}-chapter-{number}"),
        )
        return await self.chapter_repository.create_chapter(chapter)

    async def get_chapter_by_id(self, chapter_id: int) -> Optional[Chapter]:
        return await self.chapter_repository.get_chapter(chapter_id)

    async def get_chapter_by_number(
        self, work_id: int, chapter_number: Decimal
    ) -> Optional[Chapter]:
        return await self.chapter_repository.get_chapter_by_number(
            work_id, chapter_number
        )

    async def get_chapters(
        self,
        work_id: int,
        published_only: bool = False,
        order: str = "asc",
    ) -> List[Chapter]:
        return await self.chapter_repository.get_chapters(
            work_id, published_only=published_only, order=order
        )

    async def get_chapter_reader(
        self,
        chapter_id: Optional[int] = None,
        work_slug: Optional[str] = None,
        chapter_number: Optional[Decimal] = None,
        user_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        return await self.chapter_repository.get_chapter_reader_data(
            chapter_id=chapter_id,
            work_slug=work_slug,
            chapter_number=chapter_number,
            user_id=user_id,
        )


    async def update_chapter(self, chapter_id: int, chapter_data: dict) -> Chapter:
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="Capítulo no encontrado")

        for key, value in chapter_data.items():
            if hasattr(chapter, key) and value is not None:
                setattr(chapter, key, value)

        return await self.chapter_repository.update_chapter(chapter)

    async def delete_chapter(self, chapter_id: int) -> bool:
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="Capítulo no encontrado")
        return await self.chapter_repository.delete_chapter(chapter_id)

    async def create_chapter_images(
        self, images: List[ChapterImage]
    ) -> List[ChapterImage]:
        return await self.chapter_image_repository.create_chapter_images(images)

    async def delete_chapter_images(self, chapter_id: int) -> bool:
        return await self.chapter_image_repository.delete_chapter_images(chapter_id)

    async def get_chapter_images(self, chapter_id: int) -> List[ChapterImage]:
        return await self.chapter_image_repository.get_chapter_images(chapter_id)

    async def replace_chapter_page_references(
        self, chapter_id: int, pages: list[ChapterPageReference]
    ) -> List[ChapterImage]:
        orders = [page.order_number for page in pages]
        if len(orders) != len(set(orders)):
            raise HTTPException(status_code=422, detail="order_number no puede repetirse")

        images = [
            ChapterImage(
                chapter_id=chapter_id,
                image_url=page.image_url,
                order_number=page.order_number,
            )
            for page in sorted(pages, key=lambda page: page.order_number)
        ]
        return await self.chapter_image_repository.replace_chapter_images(chapter_id, images)

    # --------------------------------------------------------------------------
    # Gestión de Borradores de Traducción
    # --------------------------------------------------------------------------
    async def submit_translation(
        self,
        chapter_id: int,
        user: CurrentUser,
        data: ChapterSubmissionCreate,
    ) -> Dict[str, Any]:
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capítulo no encontrado")

        # Verificar permisos de pertenencia al scan group (cualquier rol del scan puede enviar borrador)
        if chapter.scan_group_id:
            await verify_scan_member_permission(user, chapter.scan_group_id, conn=self.chapter_repository.conn)

        # Regla estricta: validar que se envíe la totalidad de páginas del capítulo
        existing_images = await self.chapter_image_repository.get_chapter_images(chapter_id)
        if existing_images and data.page_count != len(existing_images):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Debes incluir la traducción completa de las {len(existing_images)} páginas del capítulo.",
            )

        sub_id = await self.chapter_repository.create_submission(
            chapter_id=chapter_id,
            user_id=user.id,
            content_url=data.content_url.strip(),
            page_count=data.page_count,
            notes=data.notes.strip() if data.notes else None,
        )
        return {
            "id": sub_id,
            "chapter_id": chapter_id,
            "status": "PENDING",
            "message": "Borrador de traducción enviado con éxito. Esperando revisión del líder.",
        }

    async def list_submissions(
        self,
        chapter_id: int,
        user: CurrentUser,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capítulo no encontrado")

        # Cualquier miembro del scan puede consultar las entregas de su capítulo (pero solo líderes aprueban/rechazan)
        if not is_platform_admin(user):
            if not chapter.scan_group_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos de revisión")
            member = await self.scan_repo.get_member(chapter.scan_group_id, user.id)
            if not member:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No perteneces al scan de esta obra.",
                )

        return await self.chapter_repository.list_submissions(chapter_id, status_filter)

    async def review_submission(
        self,
        chapter_id: int,
        submission_id: int,
        user: CurrentUser,
        review: ChapterSubmissionReview,
    ) -> Dict[str, Any]:
        chapter = await self.get_chapter_by_id(chapter_id)
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capítulo no encontrado")

        if not is_platform_admin(user):
            if not chapter.scan_group_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos de revisión")
            member = await self.scan_repo.get_member(chapter.scan_group_id, user.id)
            if not member or not member.can_manage:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo el líder o miembros con permisos de gestión del scan pueden aprobar o rechazar borradores.",
                )


        try:
            if review.status == "APPROVED":
                return await self.chapter_repository.approve_submission(
                    submission_id=submission_id,
                    reviewer_id=user.id,
                    reward_coins_override=review.reward_coins,
                )
            else:
                return await self.chapter_repository.reject_submission(
                    submission_id=submission_id,
                    reviewer_id=user.id,
                    reason=review.rejection_reason,
                )
        except ValueError as e:
            err_msg = str(e)
            status_code = status.HTTP_404_NOT_FOUND if "no encontrado" in err_msg.lower() else status.HTTP_400_BAD_REQUEST
            raise HTTPException(status_code=status_code, detail=err_msg)
