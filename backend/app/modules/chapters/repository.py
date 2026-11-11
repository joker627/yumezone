from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.series.models import WorkORM
from app.modules.chapters.models import (
    ChapterImageORM,
    ChapterORM,
    ChapterSubmissionORM,
)
from app.modules.notifications.models import NotificationORM
from app.modules.shop.models import UserCoinTransactionORM
from app.modules.scans.models import ScanGroupORM, ScanTreasuryTransactionORM
from app.modules.users.models import UserORM
from app.modules.chapters.schemas import Chapter, ChapterImage


class ChapterRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def get_chapter(self, chapter_id: int) -> Optional[Chapter]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT c.*, u.username AS translator_username
                    FROM chapters c
                    LEFT JOIN users u ON u.id = c.translator_user_id
                    WHERE c.id = :cid
                    """
                ),
                {"cid": chapter_id},
            )
            row = res.mappings().first()
            return Chapter(**dict(row)) if row else None

    async def get_chapter_by_number(
        self, work_id: int, chapter_number: Decimal
    ) -> Optional[Chapter]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT c.*, u.username AS translator_username
                    FROM chapters c
                    LEFT JOIN users u ON u.id = c.translator_user_id
                    WHERE c.work_id = :wid AND c.chapter_number = :cnum
                    """
                ),
                {"wid": work_id, "cnum": chapter_number},
            )
            row = res.mappings().first()
            return Chapter(**dict(row)) if row else None

    async def get_chapters(
        self,
        work_id: int,
        published_only: bool = False,
        order: str = "asc",
    ) -> List[Chapter]:
        async with resolve_session(self.conn) as session:
            where_clause = "WHERE c.work_id = :wid"
            if published_only:
                where_clause += " AND c.status = 'PUBLISHED'"
            order_dir = "DESC" if order.lower() == "desc" else "ASC"
            res = await session.execute(
                text(
                    f"""
                    SELECT c.*, u.username AS translator_username
                    FROM chapters c
                    LEFT JOIN users u ON u.id = c.translator_user_id
                    {where_clause}
                    ORDER BY c.chapter_number {order_dir}
                    """
                ),
                {"wid": work_id},
            )
            return [Chapter(**dict(r)) for r in res.mappings().all()]

    async def get_chapter_reader_data(
        self,
        chapter_id: Optional[int] = None,
        work_slug: Optional[str] = None,
        chapter_number: Optional[Decimal] = None,
        user_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            chapter_row = None
            work_row = None

            if chapter_id:
                res = await session.execute(
                    text(
                        """
                        SELECT c.id, c.work_id, c.scan_group_id, c.chapter_number, c.title, c.slug, c.status,
                               c.translator_user_id, c.reward_coins, c.published_at,
                               u.username AS translator_username,
                               sg.name AS scan_group_name,
                               w.id AS w_id, w.title AS w_title, w.slug AS w_slug,
                               w.cover_url AS w_cover_url, w.banner_url AS w_banner_url, w.author AS w_author
                        FROM chapters c
                        JOIN works w ON w.id = c.work_id
                        LEFT JOIN users u ON u.id = c.translator_user_id
                        LEFT JOIN scan_groups sg ON sg.id = c.scan_group_id
                        WHERE c.id = :cid
                        """
                    ),
                    {"cid": chapter_id},
                )
                joined_row = res.mappings().first()
                if joined_row:
                    chapter_row = {
                        "id": joined_row["id"],
                        "work_id": joined_row["work_id"],
                        "scan_group_id": joined_row["scan_group_id"],
                        "scan_group_name": joined_row["scan_group_name"],
                        "chapter_number": joined_row["chapter_number"],
                        "title": joined_row["title"],
                        "slug": joined_row["slug"],
                        "status": joined_row["status"],
                        "translator_user_id": joined_row["translator_user_id"],
                        "translator_username": joined_row["translator_username"],
                        "reward_coins": joined_row["reward_coins"],
                        "published_at": joined_row["published_at"],
                    }
                    work_row = {
                        "id": joined_row["w_id"],
                        "title": joined_row["w_title"],
                        "slug": joined_row["w_slug"],
                        "cover_url": joined_row["w_cover_url"],
                        "banner_url": joined_row["w_banner_url"],
                        "author": joined_row["w_author"],
                    }

            if not chapter_row and work_slug:
                w_res = await session.execute(
                    select(
                        WorkORM.id,
                        WorkORM.title,
                        WorkORM.slug,
                        WorkORM.cover_url,
                        WorkORM.banner_url,
                        WorkORM.author,
                    ).where(WorkORM.slug == work_slug)
                )
                w_map = w_res.mappings().first()
                if not w_map:
                    return None
                work_row = dict(w_map)

                if chapter_number is not None:
                    c_res = await session.execute(
                        text(
                            """
                            SELECT c.id, c.work_id, c.scan_group_id, c.chapter_number, c.title, c.slug, c.status,
                                   c.translator_user_id, c.reward_coins, c.published_at,
                                   u.username AS translator_username,
                                   sg.name AS scan_group_name
                            FROM chapters c
                            LEFT JOIN users u ON u.id = c.translator_user_id
                            LEFT JOIN scan_groups sg ON sg.id = c.scan_group_id
                            WHERE c.work_id = :wid AND c.chapter_number = :cnum
                            LIMIT 1
                            """
                        ),
                        {"wid": work_row["id"], "cnum": chapter_number},
                    )
                    c_map = c_res.mappings().first()
                    if c_map:
                        chapter_row = dict(c_map)

                if not chapter_row:
                    c_res = await session.execute(
                        text(
                            """
                            SELECT c.id, c.work_id, c.scan_group_id, c.chapter_number, c.title, c.slug, c.status,
                                   c.translator_user_id, c.reward_coins, c.published_at,
                                   u.username AS translator_username,
                                   sg.name AS scan_group_name
                            FROM chapters c
                            LEFT JOIN users u ON u.id = c.translator_user_id
                            LEFT JOIN scan_groups sg ON sg.id = c.scan_group_id
                            WHERE c.work_id = :wid AND c.status = 'PUBLISHED'
                            ORDER BY c.chapter_number ASC
                            LIMIT 1
                            """
                        ),
                        {"wid": work_row["id"]},
                    )
                    c_map = c_res.mappings().first()
                    if c_map:
                        chapter_row = dict(c_map)

            if not chapter_row or not work_row:
                return None

            resolved_chapter_id = chapter_row["id"]
            resolved_work_id = work_row["id"]

            pages_res = await session.execute(
                select(
                    ChapterImageORM.id,
                    ChapterImageORM.chapter_id,
                    ChapterImageORM.image_url,
                    ChapterImageORM.order_number,
                )
                .where(ChapterImageORM.chapter_id == resolved_chapter_id)
                .order_by(ChapterImageORM.order_number.asc())
            )
            pages = [dict(r) for r in pages_res.mappings().all()]

            nav_res = await session.execute(
                select(
                    ChapterORM.id,
                    ChapterORM.chapter_number,
                    ChapterORM.title,
                    ChapterORM.slug,
                )
                .where(
                    ChapterORM.work_id == resolved_work_id,
                    ChapterORM.status == "PUBLISHED",
                )
                .order_by(ChapterORM.chapter_number.asc())
            )
            navigation_chapters = [dict(r) for r in nav_res.mappings().all()]

            prev_chapter_id = None
            next_chapter_id = None
            for idx, item in enumerate(navigation_chapters):
                if item["id"] == resolved_chapter_id:
                    if idx > 0:
                        prev_chapter_id = navigation_chapters[idx - 1]["id"]
                    if idx < len(navigation_chapters) - 1:
                        next_chapter_id = navigation_chapters[idx + 1]["id"]
                    break

            user_state = {
                "is_read": False,
                "in_library": False,
                "last_page_read": 1,
                "has_higher_chapter_read": False,
            }

            if user_id:
                state_res = await session.execute(
                    text(
                        """
                        SELECT
                            EXISTS(SELECT 1 FROM user_read_chapters WHERE user_id = :uid AND chapter_id = :cid) AS is_read,
                            EXISTS(SELECT 1 FROM user_library WHERE user_id = :uid AND work_id = :wid) AS in_library,
                            EXISTS(
                                SELECT 1 FROM user_read_chapters urc
                                JOIN chapters c ON c.id = urc.chapter_id
                                WHERE urc.user_id = :uid AND urc.work_id = :wid AND c.chapter_number > :cnum
                            ) AS has_higher_read,
                            (
                                SELECT CASE WHEN rh.chapter_id = :cid THEN rh.last_page_read ELSE 1 END
                                FROM reading_history rh
                                WHERE rh.user_id = :uid AND rh.work_id = :wid
                                LIMIT 1
                            ) AS last_page_read
                        """
                    ),
                    {
                        "uid": user_id,
                        "cid": resolved_chapter_id,
                        "wid": resolved_work_id,
                        "cnum": chapter_row["chapter_number"],
                    },
                )
                state_row = state_res.mappings().first()
                if state_row:
                    user_state["is_read"] = bool(state_row["is_read"])
                    user_state["in_library"] = bool(state_row["in_library"])
                    user_state["has_higher_chapter_read"] = bool(
                        state_row["has_higher_read"]
                    )
                    user_state["last_page_read"] = (
                        state_row["last_page_read"] or 1
                    )

                if (
                    user_state["is_read"]
                    or user_state["has_higher_chapter_read"]
                ):
                    user_state["last_page_read"] = 1

            return {
                "chapter": chapter_row,
                "work": work_row,
                "pages": pages,
                "navigation": {
                    "prev_chapter_id": prev_chapter_id,
                    "next_chapter_id": next_chapter_id,
                    "chapters": navigation_chapters,
                },
                "user_state": user_state,
            }

    async def create_chapter(self, chapter: Chapter) -> Chapter:
        async with resolve_session(self.conn) as session:
            new_chap = ChapterORM(
                work_id=chapter.work_id,
                chapter_number=chapter.chapter_number,
                title=chapter.title,
                slug=chapter.slug,
                scan_group_id=chapter.scan_group_id,
                status=chapter.status,
                translator_user_id=chapter.translator_user_id,
                reward_coins=chapter.reward_coins,
                published_at=chapter.published_at,
            )
            session.add(new_chap)
            await session.flush()
            chapter.id = new_chap.id

            if chapter.status == "PUBLISHED":
                await session.execute(
                    text(
                        """
                        UPDATE work_statistics
                        SET latest_chapter_id = CASE
                                WHEN :cnum >= COALESCE(latest_chapter_number, -1) THEN :cid
                                ELSE latest_chapter_id
                            END,
                            latest_chapter_number = CASE
                                WHEN :cnum >= COALESCE(latest_chapter_number, -1) THEN :cnum
                                ELSE latest_chapter_number
                            END,
                            last_published_at = CASE
                                WHEN :cnum >= COALESCE(latest_chapter_number, -1) THEN COALESCE(:pub_at, CURRENT_TIMESTAMP)
                                ELSE last_published_at
                            END,
                            first_chapter_id = COALESCE(first_chapter_id, :cid),
                            chapters_count = COALESCE(chapters_count, 0) + 1
                        WHERE work_id = :wid
                        """
                    ),
                    {
                        "cid": chapter.id,
                        "cnum": chapter.chapter_number,
                        "pub_at": chapter.published_at,
                        "wid": chapter.work_id,
                    },
                )

            await session.commit()
            return chapter

    async def update_chapter(self, chapter: Chapter) -> Chapter:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(ChapterORM)
                .where(ChapterORM.id == chapter.id)
                .values(
                    chapter_number=chapter.chapter_number,
                    title=chapter.title,
                    slug=chapter.slug,
                    scan_group_id=chapter.scan_group_id,
                    status=chapter.status,
                    translator_user_id=chapter.translator_user_id,
                    reward_coins=chapter.reward_coins,
                    published_at=chapter.published_at,
                )
            )

            if chapter.status == "PUBLISHED":
                await session.execute(
                    text(
                        """
                        UPDATE work_statistics
                        SET latest_chapter_id = :cid,
                            latest_chapter_number = :cnum,
                            last_published_at = COALESCE(:pub_at, CURRENT_TIMESTAMP),
                            first_chapter_id = COALESCE(first_chapter_id, :cid)
                        WHERE work_id = :wid
                          AND (:cnum >= COALESCE(latest_chapter_number, -1))
                        """
                    ),
                    {
                        "cid": chapter.id,
                        "cnum": chapter.chapter_number,
                        "pub_at": chapter.published_at,
                        "wid": chapter.work_id,
                    },
                )

            await session.commit()
        return chapter

    async def delete_chapter(self, chapter_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            await session.execute(
                delete(ChapterORM).where(ChapterORM.id == chapter_id)
            )
            await session.commit()
        return True

    async def create_submission(
        self,
        chapter_id: int,
        user_id: int,
        content_url: str,
        page_count: int,
        notes: Optional[str] = None,
    ) -> int:
        async with resolve_session(self.conn) as session:
            sub = ChapterSubmissionORM(
                chapter_id=chapter_id,
                user_id=user_id,
                content_url=content_url,
                page_count=page_count,
                notes=notes,
            )
            session.add(sub)
            await session.commit()
            return sub.id

    async def list_submissions(
        self,
        chapter_id: int,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            where = "WHERE s.chapter_id = :cid"
            params: Dict[str, Any] = {"cid": chapter_id}
            if status_filter:
                where += " AND s.status = :st"
                params["st"] = status_filter.upper()

            res = await session.execute(
                text(
                    f"""
                    SELECT s.*, u.username, u.avatar_url
                    FROM chapter_submissions s
                    JOIN users u ON u.id = s.user_id
                    {where}
                    ORDER BY s.created_at DESC
                    """
                ),
                params,
            )
            return [dict(r) for r in res.mappings().all()]

    async def get_submission(
        self, submission_id: int
    ) -> Optional[Dict[str, Any]]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT s.*, u.username, u.avatar_url
                    FROM chapter_submissions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.id = :sid
                    """
                ),
                {"sid": submission_id},
            )
            row = res.mappings().first()
            return dict(row) if row else None

    async def approve_submission(
        self,
        submission_id: int,
        reviewer_id: int,
        reward_coins_override: Optional[int] = None,
    ) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            sub_res = await session.execute(
                select(ChapterSubmissionORM)
                .where(ChapterSubmissionORM.id == submission_id)
                .with_for_update()
            )
            sub = sub_res.scalar_one_or_none()
            if not sub:
                raise ValueError("Borrador no encontrado")
            if sub.status == "APPROVED":
                raise ValueError("Este borrador ya fue aprobado")

            chap_res = await session.execute(
                select(ChapterORM)
                .where(ChapterORM.id == sub.chapter_id)
                .with_for_update()
            )
            chap = chap_res.scalar_one_or_none()
            if not chap:
                raise ValueError("Capítulo no encontrado")

            w_res = await session.execute(
                select(WorkORM.id, WorkORM.title, WorkORM.slug).where(
                    WorkORM.id == chap.work_id
                )
            )
            work = dict(
                w_res.mappings().first() or {"title": "Obra", "slug": ""}
            )

            reward = (
                reward_coins_override
                if reward_coins_override is not None
                else (chap.reward_coins or 20)
            )

            sub.status = "APPROVED"
            sub.reviewed_by = reviewer_id
            sub.reviewed_at = func.current_timestamp()

            other_res = await session.execute(
                select(ChapterSubmissionORM.id, ChapterSubmissionORM.user_id).where(
                    ChapterSubmissionORM.chapter_id == sub.chapter_id,
                    ChapterSubmissionORM.id != submission_id,
                    ChapterSubmissionORM.status == "PENDING",
                )
            )
            for other in other_res.mappings().all():
                session.add(
                    NotificationORM(
                        user_id=other["user_id"],
                        type="TRANSLATION_REJECTED",
                        payload={
                            "title": "Borrador de traducción no seleccionado",
                            "message": f"Se aprobó otra entrega para el Cap. {chap.chapter_number} de '{work['title']}'. ¡Gracias por tu aporte!",
                            "chapter_id": sub.chapter_id,
                        },
                    )
                )

            await session.execute(
                delete(ChapterSubmissionORM).where(
                    ChapterSubmissionORM.chapter_id == sub.chapter_id,
                    ChapterSubmissionORM.id != submission_id,
                    ChapterSubmissionORM.status != "APPROVED",
                )
            )

            chap.translator_user_id = sub.user_id

            scan_gid = chap.scan_group_id
            if scan_gid:
                sg_res = await session.execute(
                    select(ScanGroupORM)
                    .where(ScanGroupORM.id == scan_gid)
                    .with_for_update()
                )
                sg_obj = sg_res.scalar_one_or_none()
                if sg_obj:
                    new_vault = int(sg_obj.vault_tokens or 0) + 1
                    sg_obj.vault_tokens = new_vault
                    session.add(
                        ScanTreasuryTransactionORM(
                            scan_group_id=scan_gid,
                            actor_user_id=reviewer_id,
                            target_user_id=sub.user_id,
                            amount=1,
                            balance_after=new_vault,
                            type="CHAPTER_PUBLISH_BONUS",
                            description=f"Bono editorial por aprobar traducción: {work['title']} Cap. {chap.chapter_number}",
                            reference_id=chap.id,
                        )
                    )

            user_res = await session.execute(
                select(UserORM)
                .where(UserORM.id == sub.user_id)
                .with_for_update()
            )
            user_obj = user_res.scalar_one_or_none()
            if user_obj:
                new_coins = (user_obj.coins or 0) + reward
                new_xp = (user_obj.xp or 0) + 50
                user_obj.coins = new_coins
                user_obj.xp = new_xp

                desc = f"Recompensa por traducción: {work['title']} Cap. {chap.chapter_number}"
                session.add(
                    UserCoinTransactionORM(
                        user_id=sub.user_id,
                        amount=reward,
                        balance_after=new_coins,
                        type="TRANSLATION_REWARD",
                        description=desc,
                        reference_id=chap.id,
                    )
                )
                session.add(
                    NotificationORM(
                        user_id=sub.user_id,
                        type="TRANSLATION_APPROVED",
                        payload={
                            "title": "¡Traducción Aprobada! 🎉",
                            "message": f"Tu traducción del Cap. {chap.chapter_number} de '{work['title']}' fue aprobada. Recibiste +{reward} Ghost Monedas.",
                            "coins": reward,
                            "work_id": work.get("id"),
                            "chapter_id": chap.id,
                            "url": f"/comic/{work.get('slug')}/{chap.slug}",
                        },
                    )
                )

            await session.commit()

            return {
                "id": submission_id,
                "status": "APPROVED",
                "reward_coins": reward,
                "translator_user_id": sub.user_id,
                "message": f"Borrador aprobado con éxito. Se otorgaron +{reward} monedas al traductor.",
            }

    async def reject_submission(
        self,
        submission_id: int,
        reviewer_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            sub_res = await session.execute(
                select(ChapterSubmissionORM)
                .where(ChapterSubmissionORM.id == submission_id)
                .with_for_update()
            )
            sub = sub_res.scalar_one_or_none()
            if not sub:
                raise ValueError("Borrador no encontrado")

            rejection_text = (
                reason
                or "El borrador no cumplió con los estándares de traducción del grupo."
            )

            chap_res = await session.execute(
                text(
                    """
                    SELECT c.chapter_number, w.title AS work_title
                    FROM chapters c
                    LEFT JOIN works w ON w.id = c.work_id
                    WHERE c.id = :cid
                    """
                ),
                {"cid": sub.chapter_id},
            )
            chap = chap_res.mappings().first() or {}
            work_title = chap.get("work_title") or "la obra"
            chap_num = chap.get("chapter_number") or ""

            session.add(
                NotificationORM(
                    user_id=sub.user_id,
                    type="TRANSLATION_REJECTED",
                    payload={
                        "title": "Borrador de traducción rechazado",
                        "message": f"Tu propuesta para el Cap. {chap_num} de '{work_title}' fue rechazada y retirada de la cola. Motivo: {rejection_text}",
                        "chapter_id": sub.chapter_id,
                    },
                )
            )

            await session.execute(
                delete(ChapterSubmissionORM).where(
                    ChapterSubmissionORM.id == submission_id
                )
            )
            await session.commit()

            return {
                "id": submission_id,
                "status": "DELETED",
                "reason": rejection_text,
            }


class ChapterImageRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def get_chapter_images(self, chapter_id: int) -> List[ChapterImage]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(ChapterImageORM)
                .where(ChapterImageORM.chapter_id == chapter_id)
                .order_by(ChapterImageORM.order_number.asc())
            )
            return [ChapterImage(**img.to_dict()) for img in res.scalars().all()]

    async def create_chapter_images(
        self, images: List[ChapterImage]
    ) -> List[ChapterImage]:
        async with resolve_session(self.conn) as session:
            for img in images:
                session.add(
                    ChapterImageORM(
                        chapter_id=img.chapter_id,
                        image_url=img.image_url,
                        order_number=img.order_number,
                    )
                )
            await session.commit()
        return images

    async def replace_chapter_images(
        self, chapter_id: int, images: List[ChapterImage]
    ) -> List[ChapterImage]:
        async with resolve_session(self.conn) as session:
            await session.execute(
                delete(ChapterImageORM).where(
                    ChapterImageORM.chapter_id == chapter_id
                )
            )
            if images:
                for img in images:
                    session.add(
                        ChapterImageORM(
                            chapter_id=img.chapter_id,
                            image_url=img.image_url,
                            order_number=img.order_number,
                        )
                    )

                chap_res = await session.execute(
                    select(
                        ChapterORM.id,
                        ChapterORM.work_id,
                        ChapterORM.scan_group_id,
                        ChapterORM.chapter_number,
                    ).where(ChapterORM.id == chapter_id)
                )
                chap_row = chap_res.mappings().first()
                if chap_row and chap_row.get("scan_group_id"):
                    scan_gid = chap_row["scan_group_id"]
                    chap_num = chap_row["chapter_number"]
                    bonused_res = await session.execute(
                        select(ScanTreasuryTransactionORM.id)
                        .where(
                            ScanTreasuryTransactionORM.scan_group_id == scan_gid,
                            ScanTreasuryTransactionORM.type
                            == "CHAPTER_PUBLISH_BONUS",
                            ScanTreasuryTransactionORM.reference_id == chapter_id,
                        )
                        .limit(1)
                    )
                    if bonused_res.scalar_one_or_none() is None:
                        sg_res = await session.execute(
                            select(ScanGroupORM)
                            .where(ScanGroupORM.id == scan_gid)
                            .with_for_update()
                        )
                        sg_obj = sg_res.scalar_one_or_none()
                        if sg_obj:
                            new_vault = int(sg_obj.vault_tokens or 0) + 2
                            sg_obj.vault_tokens = new_vault
                            session.add(
                                ScanTreasuryTransactionORM(
                                    scan_group_id=scan_gid,
                                    amount=2,
                                    balance_after=new_vault,
                                    type="CHAPTER_PUBLISH_BONUS",
                                    description=f"Bono por publicación de páginas .WEBP (Cap. {chap_num})",
                                    reference_id=chapter_id,
                                )
                            )
            await session.commit()
        return await self.get_chapter_images(chapter_id)

    async def delete_chapter_images(self, chapter_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            await session.execute(
                delete(ChapterImageORM).where(
                    ChapterImageORM.chapter_id == chapter_id
                )
            )
            await session.commit()
        return True
