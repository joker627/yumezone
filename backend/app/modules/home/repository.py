from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import bindparam, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.home.models import AnnouncementORM, HeroQueueORM
from app.modules.notifications.models import NotificationORM
from app.modules.admin.models import PlatformSettingORM
from app.modules.shop.models import (
    DailyMissionORM,
    UserCoinTransactionORM,
    UserDailyMissionORM,
)
from app.modules.users.models import UserORM
from app.utils.formatters import (
    format_chapter_number,
    format_relative_time,
    format_views,
    parse_json_safe,
)

WORK_BASE = """
    SELECT w.id, w.title, w.slug, w.cover_url, w.banner_url, w.author,
           sg.name AS scan_group_name, sg.slug AS scan_group_slug,
           COALESCE(ws.rating_average, 0.00)  AS rating_average,
           COALESCE(ws.rating_count,   0)     AS rating_count,
           COALESCE(ws.weekly_views,   0)     AS weekly_views,
           COALESCE(ws.monthly_views,  0)     AS monthly_views,
           COALESCE(ws.total_views,    0)     AS total_views,
           COALESCE(ws.trending_score, 0.00)  AS trending_score,
           COALESCE(ws.favorites_count, 0)    AS favorites_count,
           COALESCE(ws.chapters_count, 0)     AS chapters_count,
           ws.latest_chapter_id,
           ws.latest_chapter_number,
           ws.last_published_at AS latest_published_at,
           f.name  AS format_name,
           st.name AS status_name,
           COALESCE(
               (
                   SELECT json_agg(g.name)
                   FROM work_genres AS wg
                   JOIN genres AS g ON g.id = wg.genre_id
                   WHERE wg.work_id = w.id
               ),
               '[]'::json
           ) AS genres_json
    FROM works AS w
    LEFT JOIN scan_groups     AS sg ON sg.id = w.scan_group_id
    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
    LEFT JOIN formats         AS f  ON f.id = w.format_id
    LEFT JOIN statuses        AS st ON st.id = w.status_id
"""

RANKING_PERIODS: Dict[str, str] = {
    "weekly": "ws.weekly_views",
    "monthly": "ws.monthly_views",
    "all": "ws.total_views",
}

MISSION_DAILY_CHAPTERS = 3


class HomeRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def _attach_latest_chapter(self, works: List[Dict]) -> None:
        if not works:
            return
        ids = [w["id"] for w in works]
        async with resolve_session(self.conn) as session:
            stmt = text(
                """
                SELECT c.work_id, c.id AS chapter_id,
                       c.chapter_number,
                       c.published_at,
                       sg.name AS scan_group_name
                FROM work_statistics AS ws
                JOIN chapters AS c ON c.id = ws.latest_chapter_id
                LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
                WHERE ws.work_id IN :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            res = await session.execute(stmt, {"ids": ids})
            rows = [dict(r) for r in res.mappings().all()]

        chap_map = {r["work_id"]: r for r in rows}
        for w in works:
            ch = chap_map.get(w["id"])
            w["latest_chapter_id"] = ch["chapter_id"] if ch else None
            w["latest_chapter_number"] = ch["chapter_number"] if ch else None
            w["latest_published_at"] = ch["published_at"] if ch else None
            w["scan_group_name"] = (
                ch["scan_group_name"] if ch else w.get("scan_group_name")
            )

    def _enrich_chapter_fields(self, w: Dict) -> None:
        w["href"] = f"/pages/obra.html?slug={w['slug']}"
        raw_genres = w.get("genres_json")
        w["genres"] = (
            raw_genres
            if isinstance(raw_genres, list)
            else parse_json_safe(raw_genres, [])
        )
        if w.get("latest_chapter_id"):
            cap_str = format_chapter_number(w.get("latest_chapter_number"))
            w["chapter_href"] = (
                f"/pages/leer.html?obra={w['slug']}&capitulo={cap_str}&chapter_id={w['latest_chapter_id']}"
            )
            if w.get("latest_chapter_number") is not None:
                w["chapter_text"] = (
                    f"Cap. {format_chapter_number(w['latest_chapter_number'])}"
                )
        else:
            w["chapter_href"] = w["href"]
            w["chapter_text"] = ""

    async def get_launches(
        self, filter_format: Optional[str] = None, limit: int = 6
    ) -> List[Dict]:
        params: Dict[str, Any] = {"limit": limit}
        format_clause = ""
        if filter_format:
            format_clause = " AND f.name = :filter_format"
            params["filter_format"] = filter_format

        query = f"""
            {WORK_BASE}
            WHERE w.id IN (
                SELECT DISTINCT c.work_id
                FROM chapters AS c
                WHERE c.status = 'PUBLISHED'
                  AND c.published_at >= NOW() - INTERVAL '30 days'
            )
            {format_clause}
            ORDER BY COALESCE(ws.trending_score, 0) DESC, w.id DESC
            LIMIT :limit
        """

        async with resolve_session(self.conn) as session:
            res = await session.execute(text(query), params)
            works = [dict(r) for r in res.mappings().all()]

        await self._attach_latest_chapter(works)
        for w in works:
            self._enrich_chapter_fields(w)
            pub = w.get("latest_published_at")
            w["published_text"] = format_relative_time(pub) if pub else ""
            w["rating"] = float(w.get("rating_average") or 0)
        return works

    async def get_ranking(
        self, period: str = "weekly", limit: int = 6
    ) -> List[Dict]:
        order_col = RANKING_PERIODS.get(period, RANKING_PERIODS["weekly"])
        col_key = order_col.split(".")[-1]

        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    f"""
                    {WORK_BASE}
                    ORDER BY COALESCE({order_col}, 0) DESC,
                             COALESCE(ws.total_views, 0) DESC,
                             COALESCE(ws.favorites_count, 0) DESC,
                             COALESCE(ws.rating_average, 0.0) DESC,
                             w.id ASC
                    LIMIT :limit
                    """
                ),
                {"limit": limit},
            )
            works = [dict(r) for r in res.mappings().all()]

        for i, w in enumerate(works, start=1):
            w["position"] = i
            reads = int(w.get(col_key, 0) or w.get("total_views", 0) or 0)
            w["reads_formatted"] = format_views(reads)
            w["badge"] = w.get("format_name") or ""
            w["href"] = f"/pages/obra.html?slug={w['slug']}"
            w["rating"] = float(w.get("rating_average") or 0)
            raw_genres = w.get("genres_json")
            w["genres"] = (
                raw_genres
                if isinstance(raw_genres, list)
                else parse_json_safe(raw_genres, [])
            )
        return works

    async def get_popular(
        self, format: Optional[str] = None, limit: int = 4
    ) -> List[Dict]:
        params: Dict[str, Any] = {"limit": limit}
        format_clause = ""
        if format and format != "all":
            format_clause = " WHERE LOWER(f.name) = :fmt"
            params["fmt"] = format.lower()

        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    f"""
                    {WORK_BASE}
                    {format_clause}
                    ORDER BY COALESCE(ws.weekly_views, 0) DESC,
                             COALESCE(ws.total_views, 0) DESC,
                             COALESCE(ws.favorites_count, 0) DESC,
                             COALESCE(ws.rating_average, 0.0) DESC,
                             w.id ASC
                    LIMIT :limit
                    """
                ),
                params,
            )
            works = [dict(r) for r in res.mappings().all()]

        await self._attach_latest_chapter(works)
        for w in works:
            fav = int(w.get("favorites_count", 0) or 0)
            w["favorites_formatted"] = (
                f"{fav / 1_000:.1f}k" if fav >= 1_000 else str(fav)
            )
            self._enrich_chapter_fields(w)
            w["rating"] = float(w.get("rating_average") or 0)
        return works

    async def get_announcements(
        self, filter_type: Optional[str] = None
    ) -> List[Dict]:
        async with resolve_session(self.conn) as session:
            stmt = select(
                AnnouncementORM.type,
                AnnouncementORM.type_label,
                AnnouncementORM.source,
                AnnouncementORM.title,
                AnnouncementORM.description,
                AnnouncementORM.created_at,
                AnnouncementORM.is_resolved,
            ).where(AnnouncementORM.is_active.is_(True))
            if filter_type:
                stmt = stmt.where(AnnouncementORM.type == filter_type)
            stmt = stmt.order_by(
                AnnouncementORM.is_resolved.asc(),
                AnnouncementORM.created_at.desc(),
            ).limit(6)
            res = await session.execute(stmt)
            rows = res.mappings().all()

        return [
            {
                "type": r["type"],
                "type_label": r["type_label"],
                "source": r["source"],
                "title": r["title"],
                "description": r["description"],
                "published_text": format_relative_time(r["created_at"]),
                "is_resolved": bool(r.get("is_resolved", False)),
            }
            for r in rows
        ]

    async def get_continue_reading(
        self, user_id: int, limit: int = 3
    ) -> List[Dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT w.id, w.title, w.slug, w.cover_url,
                           c.id     AS chapter_id,
                           c.chapter_number,
                           ci_count.total_pages,
                           rh.last_page_read,
                           rh.read_at,
                           sg.name AS scan_group_name
                    FROM reading_history AS rh
                    JOIN works    AS w  ON w.id = rh.work_id
                    JOIN chapters AS c  ON c.id = rh.chapter_id
                    LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
                    LEFT JOIN (
                        SELECT chapter_id, COUNT(*) AS total_pages
                        FROM chapter_images
                        GROUP BY chapter_id
                    ) AS ci_count ON ci_count.chapter_id = c.id
                    WHERE rh.user_id = :uid
                    ORDER BY rh.read_at DESC
                    LIMIT :limit
                    """
                ),
                {"uid": user_id, "limit": limit},
            )
            rows = res.mappings().all()

        result = []
        for r in rows:
            total = int(r.get("total_pages") or 0)
            read = int(r.get("last_page_read") or 0)
            pct = round((read / total) * 100) if total > 0 else 0
            chap_str = format_chapter_number(r["chapter_number"])
            result.append(
                {
                    "work_id": r["id"],
                    "title": r["title"],
                    "slug": r["slug"],
                    "cover_url": r["cover_url"],
                    "chapter_id": r["chapter_id"],
                    "chapter_number": float(r["chapter_number"]),
                    "chapter_text": f"Cap. {chap_str}",
                    "page_text": f"Pág. {read}/{total}" if total else "",
                    "progress": pct,
                    "updated_text": format_relative_time(r["read_at"]),
                    "href": f"/pages/obra.html?slug={r['slug']}",
                    "chapter_href": f"/pages/leer.html?slug={r['slug']}&chapter_id={r['chapter_id']}",
                }
            )
        return result

    async def get_missions(self, user_id: int) -> Dict[str, Any]:
        async with resolve_session(self.conn) as session:
            user_res = await session.execute(
                text(
                    """
                    SELECT
                        u.id, u.coins, u.xp, u.streak_days, u.last_streak_date,
                        (
                            SELECT COUNT(DISTINCT chapter_id)
                            FROM user_read_chapters
                            WHERE user_id = u.id AND DATE(read_at) = CURRENT_DATE
                        ) AS chapters_read_today,
                        (
                            SELECT COUNT(*)
                            FROM comments
                            WHERE user_id = u.id AND DATE(created_at) = CURRENT_DATE
                        ) AS comments_today,
                        (
                            SELECT COUNT(*)
                            FROM user_library
                            WHERE user_id = u.id
                        ) AS library_count,
                        COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'mission_key', udm.mission_key,
                                        'xp_awarded', udm.xp_awarded,
                                        'coins_awarded', udm.coins_awarded
                                    )
                                )
                                FROM user_daily_missions AS udm
                                WHERE udm.user_id = u.id AND udm.claimed_date = CURRENT_DATE
                            ),
                            '[]'::json
                        ) AS claimed_json
                    FROM users AS u
                    WHERE u.id = :uid
                    """
                ),
                {"uid": user_id},
            )
            row = user_res.mappings().first()
            if not row:
                return {"missions": [], "chest": None}

            chapters_read = int(row.get("chapters_read_today") or 0)
            comments_count = int(row.get("comments_today") or 0)
            library_count = int(row.get("library_count") or 0)
            coins = int(row.get("coins") or 0)
            xp = int(row.get("xp") or 0)
            streak_days = int(row.get("streak_days") or 0)
            level = (xp // 1000) + 1

            raw_claimed = row.get("claimed_json")
            claimed_raw = (
                raw_claimed
                if isinstance(raw_claimed, list)
                else parse_json_safe(raw_claimed, default=[])
            )
            claimed_map = {
                r["mission_key"]: r
                for r in claimed_raw
                if isinstance(r, dict) and "mission_key" in r
            }

            dm_res = await session.execute(
                select(
                    DailyMissionORM.mission_key,
                    DailyMissionORM.title,
                    DailyMissionORM.description,
                    DailyMissionORM.category,
                    DailyMissionORM.icon,
                    DailyMissionORM.target_count,
                    DailyMissionORM.condition_type,
                    DailyMissionORM.reward_xp,
                    DailyMissionORM.reward_coins,
                    DailyMissionORM.action_url,
                    DailyMissionORM.action_text,
                )
                .where(DailyMissionORM.is_active.is_(True))
                .order_by(DailyMissionORM.sort_order.asc())
            )
            db_missions = [dict(r) for r in dm_res.mappings().all()]

        missions_def = []
        db_chest_def = None
        for dm in db_missions:
            m_key = dm["mission_key"]
            m_type = dm["condition_type"]
            target = int(dm["target_count"] or 1)

            if m_type == "CHAPTERS_READ":
                curr = chapters_read
            elif m_type == "COMMENTS":
                curr = comments_count
            elif m_type == "LIBRARY_COUNT":
                curr = library_count
            else:
                curr = 0

            item = {
                "key": m_key,
                "title": dm["title"],
                "description": dm["description"],
                "category": dm["category"],
                "icon": dm["icon"],
                "target": target,
                "current": min(target, curr),
                "reward_xp": int(dm["reward_xp"]),
                "reward_coins": int(dm["reward_coins"]),
                "action_url": dm.get("action_url") or "/pages/catalogo.html",
                "action_text": dm.get("action_text") or "Explorar",
            }

            if m_type == "DAILY_CHEST" or m_key == "daily_chest":
                db_chest_def = item
            else:
                missions_def.append(item)

        total_completed = 0
        total_claimed = 0
        formatted_missions = []
        for m in missions_def:
            is_claimed = m["key"] in claimed_map
            is_completed = m["current"] >= m["target"]
            if is_completed:
                total_completed += 1
            if is_claimed:
                total_claimed += 1
            pct = (
                min(100, int((m["current"] / m["target"]) * 100))
                if m["target"] > 0
                else 100
            )

            formatted_missions.append(
                {
                    **m,
                    "progress_pct": pct,
                    "progress_label": f"{m['current']}/{m['target']}",
                    "is_completed": is_completed,
                    "is_claimed": is_claimed,
                    "can_claim": is_completed and not is_claimed,
                }
            )

        total_missions_count = len(missions_def)
        chest_claimed = "daily_chest" in claimed_map
        chest_completed = total_claimed >= total_missions_count
        chest_can_claim = chest_completed and not chest_claimed
        chest_pct = (
            min(100, int((total_claimed / total_missions_count) * 100))
            if total_missions_count > 0
            else 100
        )

        chest_reward_xp = db_chest_def["reward_xp"] if db_chest_def else 120
        chest_reward_coins = (
            db_chest_def["reward_coins"] if db_chest_def else 30
        )
        chest_title = (
            db_chest_def["title"] if db_chest_def else "Cofre de Maestría Diaria"
        )
        chest_desc = (
            db_chest_def["description"]
            if db_chest_def
            else "Reclama todas tus misiones del día para abrir este cofre."
        )

        chest = {
            "key": "daily_chest",
            "title": chest_title,
            "description": chest_desc,
            "reward_xp": chest_reward_xp,
            "reward_coins": chest_reward_coins,
            "is_completed": chest_completed,
            "is_claimed": chest_claimed,
            "can_claim": chest_can_claim,
            "progress_pct": chest_pct,
            "progress_label": f"{total_claimed}/{total_missions_count} reclamadas",
        }

        main_pct = min(100, int((chapters_read / MISSION_DAILY_CHAPTERS) * 100))
        return {
            "description": "Completa misiones diarias, gana XP real para subir de nivel y desbloquea el cofre diario.",
            "progress_pct": main_pct,
            "progress_label": f"Progreso hoy ({chapters_read}/{MISSION_DAILY_CHAPTERS} capítulos)",
            "current": chapters_read,
            "total": MISSION_DAILY_CHAPTERS,
            "streak_days": streak_days,
            "last_streak_date": (
                str(row.get("last_streak_date"))
                if row.get("last_streak_date")
                else None
            ),
            "coins": coins,
            "xp": xp,
            "level": level,
            "level_progress_pct": min(100, int(((xp % 1000) / 1000) * 100)),
            "missions": formatted_missions,
            "chest": chest,
            "total_missions": total_missions_count,
            "total_completed": total_completed,
            "total_claimed": total_claimed,
        }

    async def get_mission(self, user_id: int) -> Dict[str, Any]:
        return await self.get_missions(user_id)

    async def claim_mission(self, user_id: int, mission_key: str) -> Dict[str, Any]:
        data = await self.get_missions(user_id)
        if not data or not data.get("missions"):
            raise ValueError("No se encontraron misiones para este usuario.")

        missions_map = {m["key"]: m for m in data["missions"]}
        chest = data["chest"]

        if mission_key == "daily_chest":
            if chest["is_claimed"]:
                raise ValueError("El cofre diario ya fue reclamado hoy.")
            if not chest["can_claim"]:
                raise ValueError(
                    "Debes completar y reclamar todas las 4 misiones del día para abrir el cofre."
                )
            xp_to_award = chest["reward_xp"]
            coins_to_award = chest["reward_coins"]
        elif mission_key in missions_map:
            m = missions_map[mission_key]
            if m["is_claimed"]:
                raise ValueError("Esta misión ya fue reclamada hoy.")
            if not m["can_claim"]:
                raise ValueError(
                    "Aún no has cumplido los requisitos de esta misión hoy."
                )
            xp_to_award = m["reward_xp"]
            coins_to_award = m["reward_coins"]
        else:
            raise ValueError("Clave de misión no válida.")

        old_xp = int(data.get("xp") or 0)
        old_coins = int(data.get("coins") or 0)
        old_last_streak_date = data.get("last_streak_date")
        old_streak = int(data.get("streak_days") or 0)
        today_val = date.today()

        async with resolve_session(self.conn) as session:
            claim_stmt = (
                pg_insert(UserDailyMissionORM)
                .values(
                    user_id=user_id,
                    mission_key=mission_key,
                    claimed_date=today_val,
                    xp_awarded=xp_to_award,
                    coins_awarded=coins_to_award,
                )
                .on_conflict_do_nothing(
                    constraint="uq_user_mission_date"
                )
            )
            await session.execute(claim_stmt)

            user_obj = await session.get(UserORM, user_id)
            if user_obj:
                user_obj.xp = (user_obj.xp or 0) + xp_to_award
                user_obj.coins = (user_obj.coins or 0) + coins_to_award
                last_date = user_obj.last_streak_date
                if last_date == today_val:
                    curr_streak = int(user_obj.streak_days or 1)
                elif last_date and (today_val - last_date).days == 1:
                    curr_streak = int(user_obj.streak_days or 0) + 1
                else:
                    curr_streak = 1
                user_obj.streak_days = curr_streak
                user_obj.last_streak_date = today_val

                if str(old_last_streak_date) != str(today_val):
                    if curr_streak > old_streak and old_last_streak_date:
                        session.add(
                            NotificationORM(
                                user_id=user_id,
                                type="streak",
                                payload={
                                    "title": "¡Racha aumentada! 🔥",
                                    "message": f"¡Increíble constancia! Has alcanzado {curr_streak} días consecutivos de lectura.",
                                    "url": "/pages/usuario.html",
                                },
                            )
                        )
                    elif curr_streak == 1:
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

            notif_title = (
                "¡Misión Diaria Completada!"
                if mission_key != "daily_chest"
                else "¡Cofre de Maestría Abierto!"
            )
            session.add(
                NotificationORM(
                    user_id=user_id,
                    type="reward",
                    payload={
                        "title": notif_title,
                        "message": f"Has recibido +{xp_to_award} XP y +{coins_to_award} Ghost Monedas.",
                        "reward_type": (
                            "mission" if mission_key != "daily_chest" else "chest"
                        ),
                        "mission_key": mission_key,
                        "xp": xp_to_award,
                        "coins": coins_to_award,
                        "url": "/#aside-mision-title",
                    },
                )
            )

            new_xp = old_xp + xp_to_award
            new_coins = old_coins + coins_to_award

            if coins_to_award > 0:
                mission_desc = (
                    "Recompensa por misión diaria"
                    if mission_key != "daily_chest"
                    else "Cofre de maestría diario"
                )
                session.add(
                    UserCoinTransactionORM(
                        user_id=user_id,
                        amount=coins_to_award,
                        balance_after=new_coins,
                        type="DAILY_MISSION",
                        description=mission_desc,
                    )
                )

            old_level = (old_xp // 1000) + 1
            new_level = (new_xp // 1000) + 1
            leveled_up = new_level > old_level

            if leveled_up:
                session.add(
                    NotificationORM(
                        user_id=user_id,
                        type="level",
                        payload={
                            "title": f"¡Subiste a Nivel {new_level}!",
                            "message": f"¡Felicidades! Alcanzaste el Nivel {new_level} con tu actividad en YumeZone.",
                            "level": new_level,
                            "url": "/pages/usuario.html",
                        },
                    )
                )

            await session.commit()

        updated_data = await self.get_missions(user_id)
        streak_days = updated_data.get("streak_days", 1)

        return {
            "success": True,
            "mission_key": mission_key,
            "xp_awarded": xp_to_award,
            "coins_awarded": coins_to_award,
            "old_xp": old_xp,
            "new_xp": new_xp,
            "old_level": old_level,
            "new_level": new_level,
            "leveled_up": leveled_up,
            "new_coins": new_coins,
            "streak_days": streak_days,
            "last_streak_date": (
                str(updated_data.get("last_streak_date"))
                if updated_data.get("last_streak_date")
                else None
            ),
            "message": f"¡Reclamaste +{xp_to_award} XP y +{coins_to_award} Ghost Monedas!",
            "missions_state": updated_data,
        }

    # Métodos del carrusel Hero integrados
    async def get_hero_groups(self) -> Dict[str, List[Dict[str, Any]]]:
        return {
            "top": await self._get_hero_group(
                "ORDER BY COALESCE(ws.trending_score, 0) DESC, w.id DESC"
            ),
            "popular": await self._get_hero_group(
                "ORDER BY COALESCE(ws.weekly_views, 0) DESC, "
                "COALESCE(ws.total_views, 0) DESC, w.id DESC"
            ),
            "new": await self._get_hero_new_group(),
        }

    async def _get_hero_group(self, order_by: str) -> List[Dict[str, Any]]:
        hero_work_query = """
            SELECT w.id, w.title, w.slug, w.alternative_title, w.synopsis,
                   w.author, w.cover_url, w.banner_url,
                   sg.id AS scan_group_id, sg.name AS scan_group_name,
                   sg.slug AS scan_group_slug, sg.logo_url AS scan_group_logo_url,
                   COALESCE(ws.total_views, 0) AS total_views,
                   COALESCE(ws.rating_average, 0.00) AS rating_average,
                   COALESCE(ws.rating_count, 0) AS rating_count,
                   COALESCE(ws.favorites_count, 0) AS favorites_count,
                   COALESCE(ws.trending_score, 0.00) AS trending_score
            FROM works AS w
            LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id
            LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
        """
        async with resolve_session(self.conn) as session:
            res = await session.execute(text(f"{hero_work_query} {order_by} LIMIT 3"))
            return [dict(r) for r in res.mappings().all()]

    async def _get_hero_new_group(self) -> List[Dict[str, Any]]:
        query = """
            SELECT w.id, w.title, w.slug, w.alternative_title, w.synopsis,
                   w.author, w.cover_url, w.banner_url,
                   sg.id AS scan_group_id, sg.name AS scan_group_name,
                   sg.slug AS scan_group_slug, sg.logo_url AS scan_group_logo_url,
                   COALESCE(ws.total_views, 0) AS total_views,
                   COALESCE(ws.rating_average, 0.00) AS rating_average,
                   COALESCE(ws.rating_count, 0) AS rating_count,
                   COALESCE(ws.favorites_count, 0) AS favorites_count,
                   COALESCE(ws.trending_score, 0.00) AS trending_score
            FROM works AS w
            LEFT JOIN scan_groups AS sg ON sg.id = w.scan_group_id
            LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
            JOIN hero_queue AS hq ON hq.work_id = w.id
            WHERE hq.status = 'ACTIVE'
              AND (hq.expires_at IS NULL OR hq.expires_at > NOW())
            ORDER BY hq.activated_at ASC, hq.id ASC
            LIMIT 3
        """
        async with resolve_session(self.conn) as session:
            res = await session.execute(text(query))
            return [dict(r) for r in res.mappings().all()]

    async def enrich_hero_works_batch(
        self, works: List[Dict[str, Any]], user_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        if not works:
            return []

        ids = [w["id"] for w in works]

        async with resolve_session(self.conn) as session:
            stmt_genres = text(
                """
                SELECT wg.work_id, g.id, g.name
                FROM work_genres AS wg
                JOIN genres AS g ON g.id = wg.genre_id
                WHERE wg.work_id IN :ids
                ORDER BY g.name
                """
            ).bindparams(bindparam("ids", expanding=True))
            genres_res = await session.execute(stmt_genres, {"ids": ids})
            genres_map: Dict[int, list] = {wid: [] for wid in ids}
            for row in genres_res.mappings().all():
                genres_map[row["work_id"]].append(
                    {"id": row["id"], "name": row["name"]}
                )

            stmt_latest = text(
                """
                SELECT ws.work_id, c.id, c.chapter_number AS number, c.title,
                       c.published_at, sg.name AS scan_group_name
                FROM work_statistics AS ws
                JOIN chapters AS c ON c.id = ws.latest_chapter_id
                LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
                WHERE ws.work_id IN :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            latest_res = await session.execute(stmt_latest, {"ids": ids})
            latest_map: Dict[int, Optional[Dict]] = {wid: None for wid in ids}
            for row in latest_res.mappings().all():
                latest_map[row["work_id"]] = dict(row)

            stmt_first = text(
                """
                SELECT c.work_id, c.id, c.chapter_number AS number
                FROM chapters AS c
                WHERE c.work_id IN :ids
                  AND c.status = 'PUBLISHED'
                  AND c.chapter_number = (
                      SELECT MIN(c2.chapter_number)
                      FROM chapters AS c2
                      WHERE c2.work_id = c.work_id AND c2.status = 'PUBLISHED'
                  )
                """
            ).bindparams(bindparam("ids", expanding=True))
            first_res = await session.execute(stmt_first, {"ids": ids})
            first_map: Dict[int, Optional[Dict]] = {wid: None for wid in ids}
            for row in first_res.mappings().all():
                first_map[row["work_id"]] = dict(row)

            stmt_next = text(
                """
                SELECT c.work_id, c.id, c.chapter_number AS number, c.title,
                       c.status, sg.name AS scan_group_name
                FROM chapters AS c
                LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
                WHERE c.work_id IN :ids
                  AND c.status = 'SCHEDULED'
                  AND c.chapter_number = (
                      SELECT MIN(c2.chapter_number)
                      FROM chapters AS c2
                      WHERE c2.work_id = c.work_id AND c2.status = 'SCHEDULED'
                  )
                """
            ).bindparams(bindparam("ids", expanding=True))
            next_res = await session.execute(stmt_next, {"ids": ids})
            next_map: Dict[int, Optional[Dict]] = {wid: None for wid in ids}
            for row in next_res.mappings().all():
                next_map[row["work_id"]] = dict(row)

            stmt_lib = text(
                """
                SELECT work_id,
                       COUNT(CASE WHEN status IS NOT NULL THEN 1 END) AS count,
                       MAX(CASE WHEN user_id = :uid AND status IS NOT NULL THEN 1 ELSE 0 END) AS is_added,
                       MAX(CASE WHEN user_id = :uid AND notify_new_chapters = TRUE
                                THEN 1 ELSE 0 END) AS is_subscribed,
                       MAX(CASE WHEN user_id = :uid THEN rating ELSE NULL END) AS user_rating
                FROM user_library
                WHERE work_id IN :ids
                GROUP BY work_id
                """
            ).bindparams(bindparam("ids", expanding=True))
            lib_res = await session.execute(
                stmt_lib, {"uid": user_id or 0, "ids": ids}
            )
            library_map: Dict[int, Dict] = {
                wid: {
                    "count": 0,
                    "is_added": 0,
                    "is_subscribed": 0,
                    "user_rating": None,
                }
                for wid in ids
            }
            for row in lib_res.mappings().all():
                library_map[row["work_id"]] = dict(row)

        return [
            {
                "work": w,
                "genres": genres_map[w["id"]],
                "latest": latest_map[w["id"]],
                "next": next_map[w["id"]],
                "first": first_map[w["id"]],
                "library": library_map[w["id"]],
            }
            for w in works
        ]

    async def rotate_hero_new_queue(self, limit: int = 3) -> None:
        async with resolve_session(self.conn) as session:
            check_res = await session.execute(
                text(
                    """
                    SELECT 1 FROM hero_queue
                    WHERE (status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= NOW())
                       OR (status = 'PENDING')
                    LIMIT 1
                    """
                )
            )
            if check_res.scalar_one_or_none() is None:
                return

            setting_res = await session.execute(
                select(PlatformSettingORM.setting_value).where(
                    PlatformSettingORM.setting_key == "hero_new_rotation_hours"
                )
            )
            setting_val = setting_res.scalar_one_or_none()
            hours = 24
            if setting_val:
                val = (
                    setting_val
                    if isinstance(setting_val, dict)
                    else parse_json_safe(setting_val, default={})
                )
                hours = int(val.get("hours", 24)) if isinstance(val, dict) else 24

            await session.execute(
                text(
                    """
                    UPDATE hero_queue
                    SET status = 'EXPIRED'
                    WHERE status = 'ACTIVE' AND expires_at IS NOT NULL
                      AND expires_at <= NOW()
                    """
                )
            )

            pending_res = await session.execute(
                select(HeroQueueORM.id)
                .where(HeroQueueORM.status == "PENDING")
                .order_by(HeroQueueORM.queued_at.asc(), HeroQueueORM.id.asc())
                .limit(limit)
            )
            pending_ids = list(pending_res.scalars().all())
            expires_at = (
                datetime.now(timezone.utc) + timedelta(hours=hours)
            ).replace(tzinfo=None)

            if pending_ids:
                await session.execute(
                    update(HeroQueueORM)
                    .where(HeroQueueORM.id.in_(pending_ids))
                    .values(
                        status="ACTIVE",
                        activated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                        expires_at=expires_at,
                    )
                )

            await session.commit()

