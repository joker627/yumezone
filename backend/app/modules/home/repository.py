import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import aiomysql


# ---------------------------------------------------------------------------
# Utilidad de tiempo relativo
# ---------------------------------------------------------------------------
def _relative_time(dt) -> str:
    if dt is None:
        return ""
    if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
        delta = datetime.now(timezone.utc) - dt
    else:
        # Datetime naive generado localmente por MySQL (NOW() / CURRENT_TIMESTAMP)
        delta = datetime.now() - dt

    secs = max(0, int(delta.total_seconds()))
    if secs < 60:
        return "Ahora"
    if secs < 3600:
        return f"Hace {secs // 60}m"
    if secs < 86400:
        return f"Hace {secs // 3600}h"
    days = secs // 86400
    if days == 1:
        return "Ayer"
    if days < 7:
        return f"Hace {days}d"
    return dt.strftime("%d/%m/%Y")


def _fmt_chapter(chapter_number) -> str:
    """Formatea número de capítulo eliminando decimales innecesarios."""
    cn = float(chapter_number)
    return str(int(cn)) if cn == int(cn) else str(cn)


def _fmt_views(views: int) -> str:
    """Formatea número de vistas con sufijos k/M."""
    if views >= 1_000_000:
        return f"{views / 1_000_000:.1f}M lecturas"
    if views >= 1_000:
        return f"{views / 1_000:.0f}k lecturas"
    if views == 1:
        return "1 lectura"
    return f"{views} lecturas"


# ---------------------------------------------------------------------------
# Query base reutilizable para obras
# ---------------------------------------------------------------------------
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
           f.name  AS format_name,
           st.name AS status_name
    FROM works AS w
    LEFT JOIN scan_groups     AS sg ON sg.id = w.scan_group_id
    LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
    LEFT JOIN formats         AS f  ON f.id = w.format_id
    LEFT JOIN statuses        AS st ON st.id = w.status_id
"""

# Periodos válidos para el ranking
RANKING_PERIODS: Dict[str, str] = {
    "weekly": "ws.weekly_views",
    "monthly": "ws.monthly_views",
    "all": "ws.total_views",
}

# Número de capítulos diarios requeridos para la misión
MISSION_DAILY_CHAPTERS = 3


class HomeRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    # -----------------------------------------------------------------------
    # Helpers internos
    # -----------------------------------------------------------------------
    async def _fetch(self, sql: str, values: tuple = ()) -> List[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(sql, values)
            return await cur.fetchall() or []

    async def _execute(self, sql: str, values: tuple = ()) -> int:
        async with self.conn.cursor() as cur:
            await cur.execute(sql, values)
            return cur.rowcount

    async def _attach_genres(self, works: List[Dict]) -> None:
        """Agrega géneros a cada obra en una sola query (evita N+1)."""
        if not works:
            return
        ids = [w["id"] for w in works]
        ph = ", ".join("%s" for _ in ids)
        rows = await self._fetch(
            f"""
            SELECT wg.work_id, g.name
            FROM work_genres AS wg
            JOIN genres AS g ON g.id = wg.genre_id
            WHERE wg.work_id IN ({ph})
            ORDER BY g.name
            """,
            tuple(ids),
        )
        genre_map: Dict[int, list] = {wid: [] for wid in ids}
        for r in rows:
            genre_map[r["work_id"]].append(r["name"])
        for w in works:
            w["genres"] = genre_map[w["id"]]

    async def _attach_latest_chapter(self, works: List[Dict]) -> None:
        """Adjunta el último capítulo publicado de cada obra (1 query)."""
        if not works:
            return
        ids = [w["id"] for w in works]
        ph = ", ".join("%s" for _ in ids)
        rows = await self._fetch(
            f"""
            SELECT c.work_id, c.id AS chapter_id,
                   c.chapter_number,
                   c.published_at,
                   sg.name AS scan_group_name
            FROM chapters AS c
            LEFT JOIN scan_groups AS sg ON sg.id = c.scan_group_id
            WHERE c.work_id IN ({ph})
              AND c.status = 'PUBLISHED'
              AND c.chapter_number = (
                  SELECT MAX(c2.chapter_number)
                  FROM chapters AS c2
                  WHERE c2.work_id = c.work_id AND c2.status = 'PUBLISHED'
              )
            """,
            tuple(ids),
        )
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
        """Añade href, chapter_href y chapter_text a una obra ya hidratada."""
        w["href"] = f"/pages/obra.html?slug={w['slug']}"
        if w.get("latest_chapter_id"):
            w["chapter_href"] = f"/pages/leer.html?chapter_id={w['latest_chapter_id']}"
            if w.get("latest_chapter_number") is not None:
                w["chapter_text"] = f"Cap. {_fmt_chapter(w['latest_chapter_number'])}"
        else:
            w["chapter_href"] = w["href"]
            w["chapter_text"] = ""

    # -----------------------------------------------------------------------
    # Lanzamientos Recientes
    # -----------------------------------------------------------------------
    async def get_launches(
        self, filter_format: Optional[str] = None, limit: int = 6
    ) -> List[Dict]:
        """Últimas obras con capítulo publicado en los últimos 30 días."""
        params: list = []
        format_clause = ""
        if filter_format:
            format_clause = " AND f.name = %s"
            params.append(filter_format)

        query = f"""
            {WORK_BASE}
            WHERE w.id IN (
                SELECT DISTINCT c.work_id
                FROM chapters AS c
                WHERE c.status = 'PUBLISHED'
                  AND c.published_at >= NOW() - INTERVAL 30 DAY
            )
            {format_clause}
            ORDER BY ws.trending_score DESC, w.id DESC
            LIMIT %s
        """
        params.append(limit)

        works = await self._fetch(query, tuple(params))
        await self._attach_genres(works)
        await self._attach_latest_chapter(works)
        for w in works:
            self._enrich_chapter_fields(w)
            pub = w.get("latest_published_at")
            w["published_text"] = _relative_time(pub) if pub else ""
            w["rating"] = float(w.get("rating_average") or 0)
        return works

    # -----------------------------------------------------------------------
    # Ranking
    # -----------------------------------------------------------------------
    async def get_ranking(self, period: str = "weekly", limit: int = 6) -> List[Dict]:
        order_col = RANKING_PERIODS.get(period, RANKING_PERIODS["weekly"])
        col_key = order_col.split(".")[-1]

        works = await self._fetch(
            f"""
            {WORK_BASE}
            ORDER BY COALESCE({order_col}, 0) DESC,
                     COALESCE(ws.total_views, 0) DESC,
                     COALESCE(ws.favorites_count, 0) DESC,
                     COALESCE(ws.rating_average, 0.0) DESC,
                     w.id ASC
            LIMIT %s
            """,
            (limit,),
        )
        for i, w in enumerate(works, start=1):
            w["position"] = i
            reads = int(w.get(col_key, 0) or w.get("total_views", 0) or 0)
            w["reads_formatted"] = _fmt_views(reads)
            w["badge"] = w.get("format_name") or ""
            w["href"] = f"/pages/obra.html?slug={w['slug']}"
            w["rating"] = float(w.get("rating_average") or 0)
        await self._attach_genres(works)
        return works

    # -----------------------------------------------------------------------
    # Populares Esta Semana
    # -----------------------------------------------------------------------
    async def get_popular(self, format: Optional[str] = None, limit: int = 4) -> List[Dict]:
        params: list = []
        format_clause = ""
        if format and format != "all":
            format_clause = " WHERE LOWER(f.name) = %s"
            params.append(format.lower())

        params.append(limit)

        works = await self._fetch(
            f"""
            {WORK_BASE}
            {format_clause}
            ORDER BY COALESCE(ws.weekly_views, 0) DESC,
                     COALESCE(ws.total_views, 0) DESC,
                     COALESCE(ws.favorites_count, 0) DESC,
                     COALESCE(ws.rating_average, 0.0) DESC,
                     w.id ASC
            LIMIT %s
            """,
            tuple(params),
        )

        await self._attach_genres(works)
        await self._attach_latest_chapter(works)
        for w in works:
            fav = int(w.get("favorites_count", 0) or 0)
            w["favorites_formatted"] = (
                f"{fav / 1_000:.1f}k" if fav >= 1_000 else str(fav)
            )
            self._enrich_chapter_fields(w)
            w["rating"] = float(w.get("rating_average") or 0)
        return works

    # -----------------------------------------------------------------------
    # Anuncios
    # -----------------------------------------------------------------------
    async def get_announcements(self, filter_type: Optional[str] = None) -> List[Dict]:
        params: list = []
        type_clause = ""
        if filter_type:
            type_clause = " AND type = %s"
            params.append(filter_type)

        rows = await self._fetch(
            f"""
            SELECT type, type_label, source, title, description, created_at
            FROM home_announcements
            WHERE is_active = TRUE
            {type_clause}
            ORDER BY created_at DESC
            LIMIT 10
            """,
            tuple(params),
        )
        return [
            {
                "type": r["type"],
                "type_label": r["type_label"],
                "source": r["source"],
                "title": r["title"],
                "description": r["description"],
                "published_text": _relative_time(r["created_at"]),
            }
            for r in rows
        ]

    # -----------------------------------------------------------------------
    # Continuar Leyendo
    # -----------------------------------------------------------------------
    async def get_continue_reading(self, user_id: int, limit: int = 3) -> List[Dict]:
        """Historial de lectura del usuario — una sola query con JOINs."""
        rows = await self._fetch(
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
            WHERE rh.user_id = %s
            ORDER BY rh.read_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        result = []
        for r in rows:
            total = int(r.get("total_pages") or 0)
            read = int(r.get("last_page_read") or 0)
            pct = round((read / total) * 100) if total > 0 else 0
            chap_str = _fmt_chapter(r["chapter_number"])
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
                    "updated_text": _relative_time(r["read_at"]),
                    "href": f"/pages/obra.html?slug={r['slug']}",
                    "chapter_href": f"/pages/leer.html?slug={r['slug']}&chapter_id={r['chapter_id']}",
                }
            )
        return result

    # -----------------------------------------------------------------------
    # Misiones Diarias y Recompensas Reales de XP
    # -----------------------------------------------------------------------
    async def get_missions(self, user_id: int) -> Dict[str, Any]:
        user_rows = await self._fetch(
            """
            SELECT 
                u.id, u.coins, u.xp, u.streak_days, u.last_streak_date,
                (
                    SELECT COUNT(DISTINCT chapter_id)
                    FROM user_read_chapters
                    WHERE user_id = u.id AND DATE(read_at) = CURDATE()
                ) AS chapters_read_today,
                (
                    SELECT COUNT(*)
                    FROM comments
                    WHERE user_id = u.id AND DATE(created_at) = CURDATE()
                ) AS comments_today,
                (
                    SELECT COUNT(*)
                    FROM user_library
                    WHERE user_id = u.id
                ) AS library_count
            FROM users AS u
            WHERE u.id = %s
            """,
            (user_id,),
        )
        if not user_rows:
            return {"missions": [], "chest": None}

        row = user_rows[0]
        chapters_read = int(row.get("chapters_read_today") or 0)
        comments_count = int(row.get("comments_today") or 0)
        library_count = int(row.get("library_count") or 0)
        coins = int(row.get("coins") or 0)
        xp = int(row.get("xp") or 0)
        streak_days = int(row.get("streak_days") or 0)
        level = (xp // 1000) + 1

        claimed_rows = await self._fetch(
            """
            SELECT mission_key, xp_awarded, coins_awarded, claimed_at
            FROM user_daily_missions
            WHERE user_id = %s AND claimed_date = CURDATE()
            """,
            (user_id,),
        )
        claimed_map = {r["mission_key"]: r for r in claimed_rows}

        missions_def = [
            {
                "key": "daily_read_1",
                "title": "Primer Capítulo",
                "description": "Lee al menos 1 capítulo completo hoy.",
                "category": "LECTURA",
                "icon": "book-open",
                "target": 1,
                "current": min(1, chapters_read),
                "reward_xp": 35,
                "reward_coins": 5,
                "action_url": "/pages/catalogo.html",
                "action_text": "Explorar obras",
            },
            {
                "key": "daily_read_3",
                "title": "Devorador de Capítulos",
                "description": "Lee 3 capítulos completos en el día.",
                "category": "LECTURA",
                "icon": "flame",
                "target": 3,
                "current": min(3, chapters_read),
                "reward_xp": 75,
                "reward_coins": 15,
                "action_url": "/pages/catalogo.html",
                "action_text": "Leer más",
            },
            {
                "key": "daily_comment",
                "title": "Voz de la Comunidad",
                "description": "Deja al menos 1 comentario u opinión.",
                "category": "COMUNIDAD",
                "icon": "message-circle",
                "target": 1,
                "current": min(1, comments_count),
                "reward_xp": 40,
                "reward_coins": 10,
                "action_url": "/pages/catalogo.html",
                "action_text": "Comentar",
            },
            {
                "key": "daily_library",
                "title": "Coleccionista",
                "description": "Ten al menos 1 obra en tu biblioteca.",
                "category": "BIBLIOTECA",
                "icon": "bookmark",
                "target": 1,
                "current": min(1, library_count),
                "reward_xp": 30,
                "reward_coins": 5,
                "action_url": "/pages/catalogo.html",
                "action_text": "Guardar obra",
            },
        ]

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
            pct = min(100, int((m["current"] / m["target"]) * 100)) if m["target"] > 0 else 100

            formatted_missions.append({
                **m,
                "progress_pct": pct,
                "progress_label": f"{m['current']}/{m['target']}",
                "is_completed": is_completed,
                "is_claimed": is_claimed,
                "can_claim": is_completed and not is_claimed,
            })

        total_missions_count = len(missions_def)
        chest_claimed = "daily_chest" in claimed_map
        chest_completed = total_claimed >= total_missions_count
        chest_can_claim = chest_completed and not chest_claimed
        chest_pct = min(100, int((total_claimed / total_missions_count) * 100))

        chest = {
            "key": "daily_chest",
            "title": "Cofre de Maestría Diaria",
            "description": "Reclama todas tus misiones del día para abrir este cofre.",
            "reward_xp": 120,
            "reward_coins": 30,
            "is_completed": chest_completed,
            "is_claimed": chest_claimed,
            "can_claim": chest_can_claim,
            "progress_pct": chest_pct,
            "progress_label": f"{total_claimed}/{total_missions_count} reclamadas",
        }

        # Backwards compatibility con vistas anteriores
        main_pct = min(100, int((chapters_read / MISSION_DAILY_CHAPTERS) * 100))
        return {
            "description": "Completa misiones diarias, gana XP real para subir de nivel y desbloquea el cofre diario.",
            "progress_pct": main_pct,
            "progress_label": f"Progreso hoy ({chapters_read}/{MISSION_DAILY_CHAPTERS} capítulos)",
            "current": chapters_read,
            "total": MISSION_DAILY_CHAPTERS,
            "streak_days": streak_days,
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
        """Alias retrocompatible para get_missions."""
        return await self.get_missions(user_id)

    async def claim_mission(self, user_id: int, mission_key: str) -> Dict[str, Any]:
        data = await self.get_missions(user_id)
        if not data or not data.get("missions"):
            raise ValueError("No se encontraron misiones para este usuario.")

        missions_map = {m["key"]: m for m in data["missions"]}
        chest = data["chest"]

        xp_to_award = 0
        coins_to_award = 0

        if mission_key == "daily_chest":
            if chest["is_claimed"]:
                raise ValueError("El cofre diario ya fue reclamado hoy.")
            if not chest["can_claim"]:
                raise ValueError("Debes completar y reclamar todas las 4 misiones del día para abrir el cofre.")
            xp_to_award = chest["reward_xp"]
            coins_to_award = chest["reward_coins"]
        elif mission_key in missions_map:
            m = missions_map[mission_key]
            if m["is_claimed"]:
                raise ValueError("Esta misión ya fue reclamada hoy.")
            if not m["can_claim"]:
                raise ValueError("Aún no has cumplido los requisitos de esta misión hoy.")
            xp_to_award = m["reward_xp"]
            coins_to_award = m["reward_coins"]
        else:
            raise ValueError("Clave de misión no válida.")

        user_rows = await self._fetch(
            "SELECT xp, coins, streak_days, last_streak_date FROM users WHERE id = %s",
            (user_id,)
        )
        if not user_rows:
            raise ValueError("Usuario no encontrado.")

        user_row = user_rows[0]
        old_xp = int(user_row.get("xp") or 0)
        old_coins = int(user_row.get("coins") or 0)
        streak_days = int(user_row.get("streak_days") or 0)
        last_streak_date = user_row.get("last_streak_date")

        streak_update_sql = ""
        now_date_rows = await self._fetch("SELECT CURDATE() as cur_d, DATE_SUB(CURDATE(), INTERVAL 1 DAY) as prev_d")
        cur_d = now_date_rows[0]["cur_d"]
        prev_d = now_date_rows[0]["prev_d"]

        if last_streak_date != cur_d:
            if last_streak_date == prev_d:
                streak_days += 1
            else:
                streak_days = 1
            streak_update_sql = ", streak_days = %s, last_streak_date = CURDATE()"
            update_vals = (xp_to_award, coins_to_award, streak_days, user_id)
        else:
            update_vals = (xp_to_award, coins_to_award, user_id)

        # 1. Registrar el reclamo
        await self._execute(
            """
            INSERT INTO user_daily_missions (user_id, mission_key, claimed_date, xp_awarded, coins_awarded)
            VALUES (%s, %s, CURDATE(), %s, %s)
            """,
            (user_id, mission_key, xp_to_award, coins_to_award),
        )

        # 2. Otorgar XP y Monedas al usuario en la base de datos
        if streak_update_sql:
            await self._execute(
                f"UPDATE users SET xp = xp + %s, coins = coins + %s {streak_update_sql} WHERE id = %s",
                update_vals,
            )
        else:
            await self._execute(
                "UPDATE users SET xp = xp + %s, coins = coins + %s WHERE id = %s",
                update_vals,
            )

        # 3. Notificar al usuario formalmente con tipo 'reward'
        try:
            notif_title = "¡Misión Diaria Completada! ⭐" if mission_key != "daily_chest" else "¡Cofre de Maestría Abierto! 🎁"
            notif_payload = json.dumps({
                "title": notif_title,
                "message": f"Has recibido +{xp_to_award} XP y +{coins_to_award} Ghost Monedas.",
                "reward_type": "mission" if mission_key != "daily_chest" else "chest",
                "mission_key": mission_key,
                "xp": xp_to_award,
                "coins": coins_to_award,
                "url": "/#aside-mision-title"
            }, ensure_ascii=False)
            await self._execute(
                """
                INSERT INTO notifications (user_id, type, payload)
                VALUES (%s, 'reward', %s)
                """,
                (user_id, notif_payload),
            )
        except Exception as notif_err:
            print(f"Error generando notificación de recompensa: {notif_err}")

        new_xp = old_xp + xp_to_award
        new_coins = old_coins + coins_to_award
        old_level = (old_xp // 1000) + 1
        new_level = (new_xp // 1000) + 1
        leveled_up = new_level > old_level

        # Si subió de nivel, crear notificación distintiva de nivel
        if leveled_up:
            try:
                lvl_payload = json.dumps({
                    "title": f"¡Subiste a Nivel {new_level}! 🏆",
                    "message": f"¡Felicidades! Alcanzaste el Nivel {new_level} con tu actividad en YumeZone.",
                    "level": new_level,
                    "url": "/pages/usuario.html"
                }, ensure_ascii=False)
                await self._execute(
                    """
                    INSERT INTO notifications (user_id, type, payload)
                    VALUES (%s, 'level', %s)
                    """,
                    (user_id, lvl_payload),
                )
            except Exception as lvl_err:
                print(f"Error generando notificación de nivel: {lvl_err}")

        updated_data = await self.get_missions(user_id)

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
            "message": f"¡Reclamaste +{xp_to_award} XP y +{coins_to_award} Ghost Monedas!",
            "missions_state": updated_data,
        }

    # -----------------------------------------------------------------------
    # Chat reciente
    # -----------------------------------------------------------------------
    async def get_recent_chat(self, limit: int = 10) -> List[Dict[str, Any]]:
        rows = await self._fetch("""
            SELECT hc.id, hc.content, hc.created_at,
                   u.username, u.avatar_url, u.anillo_url, u.platform_role, u.xp
            FROM home_chats AS hc
            JOIN users AS u ON u.id = hc.user_id
            ORDER BY hc.created_at DESC
            LIMIT %s
            """, (limit,))

        ROLE_MAP = {
            "SUPERADMIN": ("mod", "MOD"),
            "ADMIN": ("admin", "ADMIN"),
        }

        result = []
        for r in rows:
            role_key, role_label = ROLE_MAP.get(r["platform_role"], ("user", ""))
            level = (int(r.get("xp") or 0) // 1000) + 1
            result.append(
                {
                    "id": r.get("id"),
                    "username": r["username"],
                    "avatar_url": r.get("avatar_url"),
                    "anillo_url": r.get("anillo_url"),
                    "avatar_frame_url": r.get("anillo_url"),
                    "role": role_key,
                    "role_label": role_label,
                    "level": f"NV. {level}",
                    "created_text": _relative_time(r["created_at"]),
                    "content": r["content"],
                    "platform_role": r.get("platform_role"),
                }
            )
        return result
