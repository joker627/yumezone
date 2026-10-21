from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from app.modules.comments.repository import CommentRepository
from app.modules.users.models import CurrentUser


class CommentService:
    def __init__(self, repository: CommentRepository):
        self.repository = repository

    async def list_comments(
        self, work_id: int, chapter_id: Optional[int], limit: int
    ) -> List[Dict[str, Any]]:
        return await self.repository.list_comments(work_id, chapter_id, limit)

    async def create_comment(
        self,
        work_id: int,
        chapter_id: Optional[int],
        current_user: CurrentUser,
        parent_id: Optional[int],
        content: str,
        contains_spoiler: bool,
    ) -> int:
        clean_content = content.strip()
        if not clean_content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El contenido no puede estar vacío",
            )

        if chapter_id:
            exists = await self.repository.check_chapter_exists(chapter_id, work_id)
            if not exists:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Capítulo no encontrado en la obra",
                )

        if parent_id:
            parent_exists = await self.repository.check_parent_exists(
                parent_id, work_id, chapter_id
            )
            if not parent_exists:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Comentario padre no encontrado",
                )

        return await self.repository.create_comment(
            work_id, chapter_id, current_user.id, parent_id, clean_content, contains_spoiler
        )

    async def update_comment(
        self,
        comment_id: int,
        content: str,
        contains_spoiler: bool,
        current_user: CurrentUser,
    ) -> None:
        clean_content = content.strip()
        if not clean_content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El contenido no puede estar vacío",
            )

        comment = await self.repository.get_comment(comment_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Comentario no encontrado"
            )

        is_admin = current_user.platform_role.upper() in {"ADMIN", "SUPERADMIN"}
        if comment["user_id"] != current_user.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para modificar este comentario",
            )

        await self.repository.update_comment(comment_id, clean_content, contains_spoiler)

    async def delete_comment(self, comment_id: int, current_user: CurrentUser) -> None:
        comment = await self.repository.get_comment(comment_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Comentario no encontrado"
            )

        is_admin = current_user.platform_role.upper() in {"ADMIN", "SUPERADMIN"}
        if comment["user_id"] != current_user.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para eliminar este comentario",
            )

        await self.repository.delete_comment(comment_id)

    async def react_to_comment(
        self, comment_id: int, reaction: str, current_user: CurrentUser
    ) -> None:
        comment = await self.repository.get_comment(comment_id)
        if not comment or comment.get("status") != "VISIBLE":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Comentario no encontrado"
            )

        await self.repository.set_reaction(comment_id, current_user.id, reaction)

    async def report_comment(
        self,
        comment_id: int,
        reason: str,
        details: Optional[str],
        current_user: CurrentUser,
    ) -> int:
        comment = await self.repository.get_comment(comment_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Comentario no encontrado"
            )

        return await self.repository.create_report(
            current_user.id, comment_id, reason.strip(), details
        )
