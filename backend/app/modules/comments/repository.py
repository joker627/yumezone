from typing import Any, Dict, List, Optional
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.chapters.models import ChapterORM
from app.modules.comments.models import (
    CommentORM,
    CommentReactionORM,
)
from app.modules.admin.models import ContentReportORM



class CommentRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def list_comments(
        self,
        work_id: int,
        chapter_id: Optional[int],
        limit: int,
        current_user_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        chapter_filter = (
            "AND c.chapter_id = :chapter_id"
            if chapter_id
            else "AND c.chapter_id IS NULL"
        )
        user_select = (
            ", MAX(CASE WHEN cr.user_id = :uid AND cr.reaction = 'LIKE' THEN 1 ELSE 0 END) AS user_liked"
            if current_user_id
            else ", 0 AS user_liked"
        )
        params: Dict[str, Any] = {"work_id": work_id, "limit": limit}
        if chapter_id:
            params["chapter_id"] = chapter_id
        if current_user_id:
            params["uid"] = current_user_id

        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    f"""
                    SELECT c.id, c.work_id, c.chapter_id, c.parent_id, c.reply_to_username, c.content, c.contains_spoiler,
                           c.created_at, c.updated_at, u.id AS user_id, u.username, u.avatar_url,
                           u.avatar_frame_url, u.avatar_frame_url AS anillo_url,
                           COALESCE(SUM(CASE WHEN cr.reaction = 'LIKE' THEN 1 ELSE 0 END), 0) AS likes,
                           COALESCE(SUM(CASE WHEN cr.reaction = 'DISLIKE' THEN 1 ELSE 0 END), 0) AS dislikes
                           {user_select}
                    FROM comments c
                    JOIN users u ON u.id = c.user_id
                    LEFT JOIN comment_reactions cr ON cr.comment_id = c.id
                    WHERE c.work_id = :work_id AND c.status = 'VISIBLE' {chapter_filter}
                    GROUP BY c.id, u.id
                    ORDER BY c.created_at DESC
                    LIMIT :limit
                    """
                ),
                params,
            )
            return [dict(r) for r in res.mappings().all()]

    async def get_comment(self, comment_id: int) -> Optional[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    CommentORM.id, CommentORM.user_id, CommentORM.status
                ).where(CommentORM.id == comment_id)
            )
            row = res.mappings().first()
            return dict(row) if row else None

    async def check_chapter_exists(self, chapter_id: int, work_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(ChapterORM.id).where(
                    ChapterORM.id == chapter_id,
                    ChapterORM.work_id == work_id,
                    ChapterORM.status == "PUBLISHED",
                )
            )
            return res.scalar_one_or_none() is not None

    async def check_parent_exists(
        self, parent_id: int, work_id: int, chapter_id: Optional[int]
    ) -> bool:
        async with resolve_session(self.conn) as session:
            stmt = select(CommentORM.id).where(
                CommentORM.id == parent_id, CommentORM.work_id == work_id
            )
            if chapter_id is None:
                stmt = stmt.where(CommentORM.chapter_id.is_(None))
            else:
                stmt = stmt.where(CommentORM.chapter_id == chapter_id)
            res = await session.execute(stmt)
            return res.scalar_one_or_none() is not None

    async def create_comment(
        self,
        work_id: int,
        chapter_id: Optional[int],
        user_id: int,
        parent_id: Optional[int],
        reply_to_username: Optional[str],
        content: str,
        contains_spoiler: bool,
    ) -> int:
        async with resolve_session(self.conn) as session:
            comment = CommentORM(
                work_id=work_id,
                chapter_id=chapter_id,
                user_id=user_id,
                parent_id=parent_id,
                reply_to_username=reply_to_username,
                content=content,
                contains_spoiler=contains_spoiler,
            )
            session.add(comment)
            await session.commit()
            return comment.id

    async def update_comment(
        self, comment_id: int, content: str, contains_spoiler: bool
    ) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(CommentORM)
                .where(CommentORM.id == comment_id)
                .values(
                    content=content,
                    contains_spoiler=contains_spoiler,
                    updated_at=func.current_timestamp(),
                )
            )
            await session.commit()

    async def delete_comment(self, comment_id: int) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(CommentORM)
                .where(CommentORM.id == comment_id)
                .values(status="DELETED", content="")
            )
            await session.commit()

    async def toggle_reaction(
        self, comment_id: int, user_id: int, reaction: str
    ) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(CommentReactionORM.reaction).where(
                    CommentReactionORM.comment_id == comment_id,
                    CommentReactionORM.user_id == user_id,
                )
            )
            existing = res.scalar_one_or_none()

            if existing == reaction:
                await session.execute(
                    delete(CommentReactionORM).where(
                        CommentReactionORM.comment_id == comment_id,
                        CommentReactionORM.user_id == user_id,
                    )
                )
                action = "REMOVED"
            else:
                stmt = (
                    pg_insert(CommentReactionORM)
                    .values(
                        comment_id=comment_id,
                        user_id=user_id,
                        reaction=reaction,
                    )
                    .on_conflict_do_update(
                        index_elements=[
                            CommentReactionORM.comment_id,
                            CommentReactionORM.user_id,
                        ],
                        set_={"reaction": reaction},
                    )
                )
                await session.execute(stmt)
                action = "ADDED"

            likes_res = await session.execute(
                select(func.count())
                .select_from(CommentReactionORM)
                .where(
                    CommentReactionORM.comment_id == comment_id,
                    CommentReactionORM.reaction == "LIKE",
                )
            )
            likes = likes_res.scalar() or 0
            await session.commit()

            return {
                "comment_id": comment_id,
                "action": action,
                "likes": likes,
                "user_liked": 1 if action == "ADDED" and reaction == "LIKE" else 0,
            }

    async def has_pending_report(self, reporter_user_id: int, comment_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(ContentReportORM.id)
                .where(
                    ContentReportORM.reporter_user_id == reporter_user_id,
                    ContentReportORM.entity_type == "COMMENT",
                    ContentReportORM.entity_id == comment_id,
                    ContentReportORM.status.in_(("OPEN", "REVIEWING")),
                )
                .limit(1)
            )
            return res.scalar_one_or_none() is not None

    async def create_report(
        self,
        reporter_user_id: int,
        comment_id: int,
        reason: str,
        details: Optional[str],
    ) -> int:
        async with resolve_session(self.conn) as session:
            report = ContentReportORM(
                reporter_user_id=reporter_user_id,
                entity_type="COMMENT",
                entity_id=comment_id,
                reason=reason,
                details=details,
            )
            session.add(report)
            await session.commit()
            return report.id
