from datetime import date
from sqlalchemy import delete, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.modules.series.models import WorkORM, WorkStatisticsORM
from app.modules.chapters.models import ChapterORM
from app.modules.notifications.models import NotificationORM
from app.modules.users.models import (
    ReadingHistoryORM,
    UserLibraryORM,
    UserReadChapterORM,
)
from app.utils.formatters import format_chapter_number
from typing import List, Optional
from sqlalchemy import or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.shop.models import (
    ShopItemORM,
    UserCoinTransactionORM,
    UserInventoryORM,
)
from app.modules.users.models import CultivationRankORM, UserORM


class UserRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def get_user_by_identifier(self, identifier: str) -> Optional[dict]:
        if not identifier:
            return None
        raw_id = identifier.strip()
        clean_id = raw_id.lstrip("@")

        async with resolve_session(self.conn) as session:
            conds = [UserORM.username == clean_id, UserORM.user_code == clean_id]
            if clean_id.isdigit():
                conds.append(UserORM.id == int(clean_id))

            user_res = await session.execute(
                select(
                    UserORM.id,
                    UserORM.user_code,
                    UserORM.username,
                    UserORM.avatar_url,
                    UserORM.banner_url,
                    UserORM.avatar_frame_url,
                    UserORM.avatar_frame_url.label("anillo_url"),
                    UserORM.active_title,
                    UserORM.country,
                    UserORM.bio,
                    UserORM.is_private,
                    UserORM.platform_role,
                    UserORM.coins,
                    UserORM.clan_tokens,
                    UserORM.xp,
                    UserORM.streak_days,
                    UserORM.last_streak_date,
                    UserORM.created_at,
                    UserORM.status,
                )
                .where(or_(*conds), UserORM.status != "DELETED")
                .limit(1)
            )
            user_row = user_res.mappings().first()
            if not user_row:
                return None

            user = dict(user_row)
            uid = user["id"]

            scan_res = await session.execute(
                text(
                    """
                    SELECT sg.id, sg.name, sg.slug, sg.logo_url, sg.description, sgm.role,
                           (SELECT COUNT(*) FROM works w WHERE w.scan_group_id = sg.id) AS works_count
                    FROM scan_group_members sgm
                    JOIN scan_groups sg ON sg.id = sgm.group_id
                    WHERE sgm.user_id = :uid
                    ORDER BY CASE sgm.role
                        WHEN 'LEADER' THEN 1
                        WHEN 'CO_LEADER' THEN 2
                        WHEN 'UPLOADER' THEN 3
                        WHEN 'EDITOR' THEN 4
                        WHEN 'TRANSLATOR' THEN 5
                        ELSE 6
                    END ASC
                    LIMIT 1
                    """
                ),
                {"uid": uid},
            )
            scan_row = scan_res.mappings().first()
            user["scan_group"] = dict(scan_row) if scan_row else None

            stats_res = await session.execute(
                text(
                    """
                    SELECT
                        (SELECT COUNT(*) FROM user_read_chapters WHERE user_id = :uid) AS total_chapters_read,
                        (SELECT COUNT(*) FROM comments WHERE user_id = :uid) AS total_comments,
                        COALESCE(ul.completed_works, 0) AS completed_works,
                        COALESCE(ul.favorites_count, 0) AS favorites_count,
                        COALESCE(ul.pending_works, 0) AS pending_works
                    FROM (
                        SELECT
                            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_works,
                            SUM(CASE WHEN status IN ('READING', 'COMPLETED', 'ON_HOLD', 'PLAN_TO_READ') THEN 1 ELSE 0 END) AS favorites_count,
                            SUM(CASE WHEN status = 'PLAN_TO_READ' THEN 1 ELSE 0 END) AS pending_works
                        FROM user_library
                        WHERE user_id = :uid
                    ) AS ul
                    """
                ),
                {"uid": uid},
            )
            stats_row = stats_res.mappings().first()
            user["stats"] = (
                dict(stats_row)
                if stats_row
                else {
                    "total_chapters_read": 0,
                    "completed_works": 0,
                    "favorites_count": 0,
                    "pending_works": 0,
                    "total_comments": 0,
                }
            )

            fav_res = await session.execute(
                text(
                    """
                    SELECT
                        w.id, w.title, w.slug, w.cover_url, w.author, ul.status, ul.rating, ul.added_at,
                        COALESCE(f.name, 'Manga') AS format_name,
                        (SELECT COUNT(*) FROM user_read_chapters urc WHERE urc.user_id = :uid AND urc.work_id = w.id) AS chapters_read,
                        COALESCE(ws.chapters_count, 0) AS total_chapters,
                        rh.chapter_id AS last_chapter_id,
                        rh_c.chapter_number AS last_chapter_number
                    FROM user_library ul
                    JOIN works w ON w.id = ul.work_id
                    LEFT JOIN work_statistics ws ON ws.work_id = w.id
                    LEFT JOIN formats f ON f.id = w.format_id
                    LEFT JOIN reading_history rh ON rh.user_id = ul.user_id AND rh.work_id = w.id
                    LEFT JOIN chapters rh_c ON rh_c.id = rh.chapter_id
                    WHERE ul.user_id = :uid AND ul.status IS NOT NULL
                    ORDER BY COALESCE(ul.rating, 0) DESC, COALESCE(rh.read_at, ul.added_at) DESC
                    LIMIT 24
                    """
                ),
                {"uid": uid},
            )
            user["favorite_works"] = [dict(r) for r in fav_res.mappings().all()]

            inv_res = await session.execute(
                text(
                    """
                    SELECT
                        si.id AS item_id, UPPER(si.category) AS category, si.name, si.description,
                        si.preview_url, si.rarity, ui.is_equipped
                    FROM user_inventory ui
                    JOIN shop_items si ON si.id = ui.item_id
                    WHERE ui.user_id = :uid
                    ORDER BY ui.is_equipped DESC, si.required_level ASC, si.id ASC
                    """
                ),
                {"uid": uid},
            )
            user["inventory_items"] = [dict(r) for r in inv_res.mappings().all()]

            return user

    async def update_user(self, user_id: int, data: dict) -> bool:
        allowed_fields = {
            "username",
            "bio",
            "avatar_url",
            "banner_url",
            "anillo_url",
            "avatar_frame_url",
            "active_title",
            "country",
            "is_private",
        }
        filtered_data = {k: v for k, v in data.items() if k in allowed_fields}
        if not filtered_data:
            return False

        async with resolve_session(self.conn) as session:
            if "username" in filtered_data:
                new_uname = (filtered_data["username"] or "").strip()
                if not new_uname:
                    filtered_data.pop("username", None)
                else:
                    dup_res = await session.execute(
                        select(UserORM.id).where(
                            UserORM.username == new_uname,
                            UserORM.id != user_id,
                        )
                    )
                    if dup_res.scalar_one_or_none() is not None:
                        raise ValueError(
                            "El nombre de usuario ya está en uso por otra cuenta"
                        )
                    filtered_data["username"] = new_uname

            inv_res = await session.execute(
                select(
                    ShopItemORM.id.label("item_id"),
                    ShopItemORM.category,
                    ShopItemORM.preview_url,
                    ShopItemORM.name,
                )
                .join(UserInventoryORM, ShopItemORM.id == UserInventoryORM.item_id)
                .where(UserInventoryORM.user_id == user_id)
            )
            owned_items = [dict(r) for r in inv_res.mappings().all()]
            owned_banners = {
                r["preview_url"]: r["item_id"]
                for r in owned_items
                if (r["category"] or "").upper() == "BANNER" and r.get("preview_url")
            }
            owned_frames = {
                r["preview_url"]: r["item_id"]
                for r in owned_items
                if (r["category"] or "").upper() == "FRAME" and r.get("preview_url")
            }
            owned_titles = {
                r["name"]: r["item_id"]
                for r in owned_items
                if (r["category"] or "").upper() == "TITLE" and r.get("name")
            }

            if "banner_url" in filtered_data:
                b_val = (filtered_data["banner_url"] or "").strip() or None
                if b_val and b_val not in owned_banners:
                    filtered_data.pop("banner_url", None)
                else:
                    filtered_data["banner_url"] = b_val
                    await session.execute(
                        text(
                            """
                            UPDATE user_inventory ui
                            SET is_equipped = FALSE
                            FROM shop_items si
                            WHERE ui.item_id = si.id
                              AND ui.user_id = :uid
                              AND UPPER(si.category) = 'BANNER'
                            """
                        ),
                        {"uid": user_id},
                    )
                    if b_val and b_val in owned_banners:
                        await session.execute(
                            update(UserInventoryORM)
                            .where(
                                UserInventoryORM.user_id == user_id,
                                UserInventoryORM.item_id == owned_banners[b_val],
                            )
                            .values(is_equipped=True)
                        )

            frame_input = filtered_data.pop("avatar_frame_url", None) or filtered_data.pop(
                "anillo_url", None
            )
            if (
                frame_input is not None
                or "avatar_frame_url" in data
                or "anillo_url" in data
            ):
                f_val = (frame_input or "").strip() or None
                if not (f_val and f_val not in owned_frames):
                    filtered_data["avatar_frame_url"] = f_val
                    await session.execute(
                        text(
                            """
                            UPDATE user_inventory ui
                            SET is_equipped = FALSE
                            FROM shop_items si
                            WHERE ui.item_id = si.id
                              AND ui.user_id = :uid
                              AND UPPER(si.category) = 'FRAME'
                            """
                        ),
                        {"uid": user_id},
                    )
                    if f_val and f_val in owned_frames:
                        await session.execute(
                            update(UserInventoryORM)
                            .where(
                                UserInventoryORM.user_id == user_id,
                                UserInventoryORM.item_id == owned_frames[f_val],
                            )
                            .values(is_equipped=True)
                        )

            if "active_title" in filtered_data:
                t_val = (filtered_data["active_title"] or "").strip() or None
                if t_val and t_val not in owned_titles:
                    filtered_data.pop("active_title", None)
                else:
                    filtered_data["active_title"] = t_val
                    await session.execute(
                        text(
                            """
                            UPDATE user_inventory ui
                            SET is_equipped = FALSE
                            FROM shop_items si
                            WHERE ui.item_id = si.id
                              AND ui.user_id = :uid
                              AND UPPER(si.category) = 'TITLE'
                            """
                        ),
                        {"uid": user_id},
                    )
                    if t_val and t_val in owned_titles:
                        await session.execute(
                            update(UserInventoryORM)
                            .where(
                                UserInventoryORM.user_id == user_id,
                                UserInventoryORM.item_id == owned_titles[t_val],
                            )
                            .values(is_equipped=True)
                        )

            if not filtered_data:
                if self.conn is None:
                    await session.commit()
                return True

            await session.execute(
                update(UserORM)
                .where(UserORM.id == user_id)
                .values(**filtered_data)
            )
            if self.conn is None:
                await session.commit()
            return True

    async def search_users(self, query: str, limit: int = 10) -> List[dict]:
        async with resolve_session(self.conn) as session:
            search_term = f"%{query}%"
            res = await session.execute(
                select(
                    UserORM.id,
                    UserORM.user_code,
                    UserORM.username,
                    UserORM.avatar_url,
                    UserORM.avatar_frame_url,
                    UserORM.avatar_frame_url.label("anillo_url"),
                    UserORM.active_title,
                    UserORM.platform_role,
                    UserORM.xp,
                )
                .where(
                    or_(
                        UserORM.username.ilike(search_term),
                        UserORM.user_code.ilike(search_term),
                    ),
                    UserORM.status == "ACTIVE",
                    UserORM.is_private.is_(False),
                )
                .order_by(UserORM.xp.desc())
                .limit(limit)
            )
            return [dict(r) for r in res.mappings().all()]

    async def list_coin_transactions(
        self, user_id: int, limit: int = 50, offset: int = 0
    ) -> List[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    UserCoinTransactionORM.id,
                    UserCoinTransactionORM.user_id,
                    UserCoinTransactionORM.amount,
                    UserCoinTransactionORM.balance_after,
                    UserCoinTransactionORM.type,
                    UserCoinTransactionORM.description,
                    UserCoinTransactionORM.reference_id,
                    UserCoinTransactionORM.created_at,
                )
                .where(UserCoinTransactionORM.user_id == user_id)
                .order_by(
                    UserCoinTransactionORM.created_at.desc(),
                    UserCoinTransactionORM.id.desc(),
                )
                .limit(limit)
                .offset(offset)
            )
            return [dict(r) for r in res.mappings().all()]

    async def get_cultivation_ranks(self) -> List[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    CultivationRankORM.min_level,
                    CultivationRankORM.max_level,
                    CultivationRankORM.title,
                    CultivationRankORM.badge_icon,
                    CultivationRankORM.reward_coins,
                ).order_by(CultivationRankORM.min_level.asc())
            )
            return [dict(r) for r in res.mappings().all()]

    async def exchange_currency(
        self, user_id: int, direction: str, amount: int
    ) -> dict:
        rate = 100
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(UserORM).where(UserORM.id == user_id).with_for_update()
            )
            user_obj = res.scalar_one_or_none()
            if not user_obj:
                raise ValueError("Usuario no encontrado")

            coins = int(user_obj.coins or 0)
            tokens = int(user_obj.clan_tokens or 0)

            if direction == "COINS_TO_TOKENS":
                cost = amount * rate
                if coins < cost:
                    raise ValueError(
                        f"Monedas insuficientes. Necesitas {cost} monedas para obtener {amount} Piedras Espirituales."
                    )
                user_obj.coins = coins - cost
                user_obj.clan_tokens = tokens + amount
                session.add(
                    UserCoinTransactionORM(
                        user_id=user_id,
                        amount=-cost,
                        balance_after=user_obj.coins,
                        type="CLAN_TOKEN_CONVERSION",
                        description=f"Conversión de {cost} monedas a {amount} Piedras Espirituales",
                    )
                )
            elif direction == "TOKENS_TO_COINS":
                if tokens < amount:
                    raise ValueError(
                        f"Piedras Espirituales insuficientes. Tienes {tokens} disponibles."
                    )
                gained = amount * rate
                user_obj.clan_tokens = tokens - amount
                user_obj.coins = coins + gained
                session.add(
                    UserCoinTransactionORM(
                        user_id=user_id,
                        amount=gained,
                        balance_after=user_obj.coins,
                        type="CLAN_TOKEN_CONVERSION",
                        description=f"Conversión de {amount} Piedras Espirituales a {gained} monedas",
                    )
                )
            else:
                raise ValueError("Dirección de intercambio no válida")

            if self.conn is None:
                await session.commit()
            else:
                await session.flush()

            return {
                "coins": user_obj.coins,
                "clan_tokens": user_obj.clan_tokens,
                "direction": direction,
                "amount": amount,
            }





    async def get_notification_preference(
        self, user_id: int, work_id: int
    ) -> Optional[bool]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(UserLibraryORM.notify_new_chapters).where(
                    UserLibraryORM.user_id == user_id,
                    UserLibraryORM.work_id == work_id,
                )
            )
            val = res.scalar_one_or_none()
            return bool(val) if val is not None else None

    async def list_for_user(
        self, user_id: int, work_id: Optional[int] = None
    ) -> list[dict]:
        status_filter = " AND ul.status IS NOT NULL" if work_id is None else ""
        work_filter = " AND w.id = :work_id" if work_id is not None else ""
        params = {"user_id": user_id}
        if work_id is not None:
            params["work_id"] = work_id

        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    f"""
                    SELECT w.id, w.title, w.slug, w.alternative_title, w.synopsis,
                           w.author, w.cover_url, w.banner_url, w.status_id,
                           w.format_id, w.demographic_id, w.scan_group_id,
                           COALESCE(ws.total_views, 0) AS total_views,
                           COALESCE(ws.rating_average, 0) AS rating_average,
                           COALESCE(ws.rating_count, 0) AS rating_count,
                           COALESCE(ws.favorites_count, 0) AS favorites_count,
                           COALESCE(ws.trending_score, 0) AS trending_score,
                           ws.first_chapter_id,
                           ul.status AS library_status,
                           ul.rating,
                           COALESCE(ul.notify_new_chapters, FALSE) AS notify_new_chapters,
                           COALESCE(ul.added_at, rh.read_at) AS added_at,
                           rh.chapter_id AS last_chapter_id,
                           rh_c.chapter_number AS last_chapter_number,
                           rh.last_page_read,
                           rh.read_at AS last_read_at,
                           COALESCE((
                               SELECT COUNT(*) FROM chapters c WHERE c.work_id = w.id AND c.status = 'PUBLISHED'
                           ), ws.chapters_count, 0) AS total_published_chapters,
                           COALESCE((
                               SELECT COUNT(DISTINCT urc.chapter_id)
                               FROM user_read_chapters AS urc
                               WHERE urc.user_id = ul.user_id AND urc.work_id = w.id
                           ), 0) AS read_chapters_count
                    FROM user_library AS ul
                    JOIN works AS w ON w.id = ul.work_id
                    LEFT JOIN reading_history AS rh ON rh.user_id = ul.user_id AND rh.work_id = w.id
                    LEFT JOIN chapters AS rh_c ON rh_c.id = rh.chapter_id
                    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                    WHERE ul.user_id = :user_id{status_filter}{work_filter}
                    ORDER BY COALESCE(rh.read_at, ul.added_at) DESC
                    """
                ),
                params,
            )
            rows = [dict(r) for r in res.mappings().all()]
            items = []
            for r in rows:
                total_chaps = int(r.get("total_published_chapters") or 0)
                read_chaps = int(r.get("read_chapters_count") or 0)
                display_read = min(total_chaps, read_chaps) if total_chaps > 0 else read_chaps
                remaining = max(0, total_chaps - read_chaps)
                progress_pct = (
                    min(100, round((read_chaps / total_chaps) * 100)) if total_chaps > 0 else 0
                )

                reading_progress = None
                if r.get("last_chapter_id") or read_chaps > 0:
                    chap_num = (
                        float(r["last_chapter_number"])
                        if r.get("last_chapter_number") is not None
                        else 1.0
                    )
                    chap_str = format_chapter_number(chap_num)
                    last_page = int(r.get("last_page_read") or 1)
                    reading_progress = {
                        "chapter_id": r.get("last_chapter_id")
                        or r.get("first_chapter_id")
                        or 0,
                        "chapter_number": chap_num,
                        "chapter_text": f"Cap. {chap_str}",
                        "last_page_read": last_page,
                        "total_pages": 1,
                        "read_chapters": display_read,
                        "total_chapters": total_chaps,
                        "remaining_chapters": remaining,
                        "page_text": (
                            f"{display_read}/{total_chaps} leídos"
                            if total_chaps > 0
                            else ""
                        ),
                        "progress_pct": progress_pct,
                        "read_at": r.get("last_read_at"),
                        "reader_url": (
                            f"/pages/leer.html?obra={r['slug']}&capitulo={chap_str}&chapter_id={r['last_chapter_id']}"
                            if r.get("last_chapter_id")
                            else f"/pages/leer.html?obra={r['slug']}&chapter_id={r.get('first_chapter_id')}"
                        ),
                    }
                raw_status = r.get("library_status")
                if raw_status in ("FAVORITE", "FOLLOWING", "LIKED"):
                    raw_status = "READING"
                elif raw_status == "READ_LATER":
                    raw_status = "PLAN_TO_READ"
                elif raw_status == "PAUSED":
                    raw_status = "ON_HOLD"
                r["library_status"] = raw_status
                r["reading_progress"] = reading_progress
                items.append(r)
            return items

    async def get_for_user(self, user_id: int, work_id: int) -> Optional[dict]:
        items = await self.list_for_user(user_id, work_id)
        return items[0] if items else None

    async def work_exists(self, work_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(WorkORM.id).where(WorkORM.id == work_id)
            )
            return res.scalar_one_or_none() is not None

    async def _sync_favorites_count(
        self, session: AsyncSession, work_id: int
    ) -> None:
        await session.execute(
            text(
                """
                UPDATE work_statistics
                SET favorites_count = (
                    SELECT COUNT(*) FROM user_library
                    WHERE work_id = :wid AND status IS NOT NULL AND status != 'DROPPED'
                )
                WHERE work_id = :wid
                """
            ),
            {"wid": work_id},
        )

    async def add_work(
        self, user_id: int, work_id: int, status: str = "READING"
    ) -> None:
        notify = status != "DROPPED"
        async with resolve_session(self.conn) as session:
            stmt = (
                pg_insert(UserLibraryORM)
                .values(
                    user_id=user_id,
                    work_id=work_id,
                    status=status,
                    notify_new_chapters=notify,
                )
                .on_conflict_do_update(
                    index_elements=[UserLibraryORM.user_id, UserLibraryORM.work_id],
                    set_={"status": status, "notify_new_chapters": notify},
                )
            )
            await session.execute(stmt)
            await self._sync_favorites_count(session, work_id)
            await session.commit()

    async def update_status(self, user_id: int, work_id: int, status: str) -> bool:
        notify = status != "DROPPED"
        async with resolve_session(self.conn) as session:
            exists = await session.execute(
                select(WorkORM.id).where(WorkORM.id == work_id)
            )
            if exists.scalar_one_or_none() is None:
                return False

            stmt = (
                pg_insert(UserLibraryORM)
                .values(
                    user_id=user_id,
                    work_id=work_id,
                    status=status,
                    notify_new_chapters=notify,
                )
                .on_conflict_do_update(
                    index_elements=[UserLibraryORM.user_id, UserLibraryORM.work_id],
                    set_={"status": status, "notify_new_chapters": notify},
                )
            )
            await session.execute(stmt)
            await self._sync_favorites_count(session, work_id)
            await session.commit()
            return True

    async def remove_work(self, user_id: int, work_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            upd_res = await session.execute(
                update(UserLibraryORM)
                .where(
                    UserLibraryORM.user_id == user_id,
                    UserLibraryORM.work_id == work_id,
                    UserLibraryORM.rating.is_not(None),
                )
                .values(status=None, notify_new_chapters=False)
            )
            updated_rating = upd_res.rowcount or 0

            del_res = await session.execute(
                delete(UserLibraryORM).where(
                    UserLibraryORM.user_id == user_id,
                    UserLibraryORM.work_id == work_id,
                    UserLibraryORM.rating.is_(None),
                )
            )
            deleted_lib = (del_res.rowcount or 0) + updated_rating

            await self._sync_favorites_count(session, work_id)
            await session.commit()
            return deleted_lib > 0

    async def update_notification_preference(
        self, user_id: int, work_id: int, notify_new_chapters: bool
    ) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                update(UserLibraryORM)
                .where(
                    UserLibraryORM.user_id == user_id,
                    UserLibraryORM.work_id == work_id,
                )
                .values(notify_new_chapters=notify_new_chapters)
            )
            await session.commit()
            if (res.rowcount or 0) > 0:
                return True

            exists = await session.execute(
                select(UserLibraryORM.user_id).where(
                    UserLibraryORM.user_id == user_id,
                    UserLibraryORM.work_id == work_id,
                )
            )
            return exists.scalar_one_or_none() is not None

    async def save_reading_history(
        self,
        user_id: int,
        work_id: int,
        chapter_id: int,
        page: int = 1,
        completed: bool = False,
    ) -> None:
        async with resolve_session(self.conn) as session:
            if completed:
                await session.execute(
                    text(
                        """
                        INSERT INTO user_read_chapters (user_id, work_id, chapter_id)
                        SELECT :uid, c.work_id, c.id
                        FROM chapters c
                        WHERE c.work_id = :wid
                          AND c.status = 'PUBLISHED'
                          AND c.chapter_number <= (SELECT chapter_number FROM chapters WHERE id = :cid)
                        ON CONFLICT (user_id, chapter_id) DO UPDATE
                        SET read_at = CURRENT_TIMESTAMP
                        """
                    ),
                    {"uid": user_id, "wid": work_id, "cid": chapter_id},
                )
            else:
                await session.execute(
                    text(
                        """
                        INSERT INTO user_read_chapters (user_id, work_id, chapter_id)
                        SELECT :uid, c.work_id, c.id
                        FROM chapters c
                        WHERE c.work_id = :wid
                          AND c.status = 'PUBLISHED'
                          AND c.chapter_number < (SELECT chapter_number FROM chapters WHERE id = :cid)
                        ON CONFLICT (user_id, chapter_id) DO NOTHING
                        """
                    ),
                    {"uid": user_id, "wid": work_id, "cid": chapter_id},
                )

                await session.execute(
                    text(
                        """
                        INSERT INTO user_library (user_id, work_id, status, notify_new_chapters)
                        VALUES (:uid, :wid, 'READING', TRUE)
                        ON CONFLICT (user_id, work_id) DO UPDATE SET
                            status = CASE
                                WHEN user_library.status IS NULL
                                  OR user_library.status IN ('PLAN_TO_READ', 'ON_HOLD')
                                THEN 'READING'
                                ELSE user_library.status
                            END,
                            notify_new_chapters = TRUE
                        """
                    ),
                    {"uid": user_id, "wid": work_id},
                )

                try:
                    user_obj = await session.get(UserORM, user_id)
                    if user_obj:
                        old_streak = int(user_obj.streak_days or 0)
                        today_val = date.today()
                        last_date = user_obj.last_streak_date
                        diff_days = (
                            (today_val - last_date).days
                            if last_date is not None
                            else None
                        )
                        if diff_days is None:
                            user_obj.streak_days = 1
                            user_obj.last_streak_date = today_val
                            session.add(
                                NotificationORM(
                                    user_id=user_id,
                                    type="streak",
                                    payload={
                                        "title": "¡Racha iniciada! 🔥",
                                        "message": "Has comenzado tu racha de lectura. ¡Lee cada día para aumentarla!",
                                        "url": "/pages/usuario.html",
                                    },
                                )
                            )
                        elif diff_days == 1:
                            new_streak = old_streak + 1
                            user_obj.streak_days = new_streak
                            user_obj.last_streak_date = today_val
                            session.add(
                                NotificationORM(
                                    user_id=user_id,
                                    type="streak",
                                    payload={
                                        "title": "¡Racha aumentada! 🔥",
                                        "message": f"¡Increíble constancia! Has alcanzado {new_streak} días consecutivos de lectura.",
                                        "url": "/pages/usuario.html",
                                    },
                                )
                            )
                        elif diff_days > 1:
                            user_obj.streak_days = 1
                            user_obj.last_streak_date = today_val
                            session.add(
                                NotificationORM(
                                    user_id=user_id,
                                    type="streak",
                                    payload={
                                        "title": "¡Racha diaria activada! 🔥",
                                        "message": "Has validado tu racha diaria de lectura. ¡Vuelve mañana para continuarla!",
                                        "url": "/pages/usuario.html",
                                    },
                                )
                            )
                except Exception as err:
                    print(f"Error actualizando racha en lectura: {err}")

            rh_stmt = (
                pg_insert(ReadingHistoryORM)
                .values(
                    user_id=user_id,
                    work_id=work_id,
                    chapter_id=chapter_id,
                    last_page_read=page or 1,
                )
                .on_conflict_do_update(
                    index_elements=[
                        ReadingHistoryORM.user_id,
                        ReadingHistoryORM.work_id,
                    ],
                    set_={
                        "chapter_id": chapter_id,
                        "last_page_read": page or 1,
                        "read_at": func.current_timestamp(),
                    },
                )
            )
            await session.execute(rh_stmt)
            await session.commit()

    async def get_user_read_chapters(self, user_id: int, work_id: int) -> List[int]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(UserReadChapterORM.chapter_id).where(
                    UserReadChapterORM.user_id == user_id,
                    UserReadChapterORM.work_id == work_id,
                )
            )
            return [int(cid) for cid in res.scalars().all()]

    async def toggle_chapter_read(self, user_id: int, chapter_id: int) -> dict:
        async with resolve_session(self.conn) as session:
            ch_res = await session.execute(
                select(ChapterORM.work_id, ChapterORM.chapter_number).where(
                    ChapterORM.id == chapter_id
                )
            )
            ch = ch_res.mappings().first()
            if not ch:
                raise ValueError("Capítulo no encontrado")
            work_id = int(ch["work_id"])

            already_res = await session.execute(
                select(UserReadChapterORM.chapter_id).where(
                    UserReadChapterORM.user_id == user_id,
                    UserReadChapterORM.chapter_id == chapter_id,
                )
            )
            already_read = already_res.scalar_one_or_none() is not None

            if already_read:
                await session.execute(
                    delete(UserReadChapterORM).where(
                        UserReadChapterORM.user_id == user_id,
                        UserReadChapterORM.chapter_id == chapter_id,
                    )
                )
                is_read = False
            else:
                stmt = (
                    pg_insert(UserReadChapterORM)
                    .values(
                        user_id=user_id, work_id=work_id, chapter_id=chapter_id
                    )
                    .on_conflict_do_update(
                        index_elements=[
                            UserReadChapterORM.user_id,
                            UserReadChapterORM.chapter_id,
                        ],
                        set_={"read_at": func.current_timestamp()},
                    )
                )
                await session.execute(stmt)
                is_read = True

            latest_res = await session.execute(
                select(ChapterORM.id)
                .join(
                    UserReadChapterORM,
                    ChapterORM.id == UserReadChapterORM.chapter_id,
                )
                .where(
                    UserReadChapterORM.user_id == user_id,
                    UserReadChapterORM.work_id == work_id,
                )
                .order_by(ChapterORM.chapter_number.desc(), ChapterORM.id.desc())
                .limit(1)
            )
            latest_id = latest_res.scalar_one_or_none()
            if latest_id is not None:
                rh_stmt = (
                    pg_insert(ReadingHistoryORM)
                    .values(
                        user_id=user_id,
                        work_id=work_id,
                        chapter_id=int(latest_id),
                        last_page_read=1,
                    )
                    .on_conflict_do_update(
                        index_elements=[
                            ReadingHistoryORM.user_id,
                            ReadingHistoryORM.work_id,
                        ],
                        set_={
                            "chapter_id": int(latest_id),
                            "read_at": func.current_timestamp(),
                        },
                    )
                )
                await session.execute(rh_stmt)

            await session.commit()

            cnt_res = await session.execute(
                select(func.count())
                .select_from(UserReadChapterORM)
                .where(
                    UserReadChapterORM.user_id == user_id,
                    UserReadChapterORM.work_id == work_id,
                )
            )
            read_count = int(cnt_res.scalar() or 0)

            return {
                "chapter_id": chapter_id,
                "work_id": work_id,
                "is_read": is_read,
                "read_count": read_count,
            }

    async def set_work_rating(
        self, user_id: int, work_id: int, rating: float
    ) -> dict:
        async with resolve_session(self.conn) as session:
            stmt = (
                pg_insert(UserLibraryORM)
                .values(
                    user_id=user_id,
                    work_id=work_id,
                    status=None,
                    rating=rating,
                )
                .on_conflict_do_update(
                    index_elements=[
                        UserLibraryORM.user_id,
                        UserLibraryORM.work_id,
                    ],
                    set_={"rating": rating},
                )
            )
            await session.execute(stmt)

            await session.execute(
                text(
                    """
                    INSERT INTO work_statistics (work_id, rating_average, rating_count)
                    VALUES (:wid, :rating, 1)
                    ON CONFLICT (work_id) DO UPDATE SET
                        rating_average = COALESCE((
                            SELECT ROUND(AVG(ul.rating), 2)
                            FROM user_library AS ul
                            WHERE ul.work_id = :wid AND ul.rating IS NOT NULL
                        ), 0.00),
                        rating_count = (
                            SELECT COUNT(ul.rating)
                            FROM user_library AS ul
                            WHERE ul.work_id = :wid AND ul.rating IS NOT NULL
                        )
                    """
                ),
                {"wid": work_id, "rating": rating},
            )
            await session.commit()

            stats_res = await session.execute(
                select(
                    func.coalesce(WorkStatisticsORM.rating_average, 0.0).label(
                        "rating_average"
                    ),
                    func.coalesce(WorkStatisticsORM.rating_count, 0).label(
                        "rating_count"
                    ),
                ).where(WorkStatisticsORM.work_id == work_id)
            )
            row = stats_res.mappings().first() or {
                "rating_average": rating,
                "rating_count": 1,
            }
            return {
                "work_id": work_id,
                "user_rating": float(rating),
                "rating_average": float(row["rating_average"]),
                "rating_count": int(row["rating_count"]),
            }

    async def get_user_work_rating(
        self, user_id: int, work_id: int
    ) -> Optional[float]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(UserLibraryORM.rating).where(
                    UserLibraryORM.user_id == user_id,
                    UserLibraryORM.work_id == work_id,
                )
            )
            val = res.scalar_one_or_none()
            return float(val) if val is not None else None

    async def mark_all_chapters_read(
        self, user_id: int, work_id: int, read: bool = True
    ) -> int:
        async with resolve_session(self.conn) as session:
            if not read:
                res = await session.execute(
                    delete(UserReadChapterORM).where(
                        UserReadChapterORM.user_id == user_id,
                        UserReadChapterORM.work_id == work_id,
                    )
                )
                affected = res.rowcount or 0
            else:
                res = await session.execute(
                    text(
                        """
                        INSERT INTO user_read_chapters (user_id, work_id, chapter_id)
                        SELECT :uid, c.work_id, c.id
                        FROM chapters c
                        WHERE c.work_id = :wid AND c.status = 'PUBLISHED'
                        ON CONFLICT (user_id, chapter_id) DO UPDATE
                        SET read_at = CURRENT_TIMESTAMP
                        """
                    ),
                    {"uid": user_id, "wid": work_id},
                )
                affected = res.rowcount or 0
            await session.commit()
            return affected

UsersRepository = UserRepository
LibraryRepository = UserRepository
