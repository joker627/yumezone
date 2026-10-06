from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import aiomysql


# ---------------------------------------------------------------------------
# Utilidad de tiempo relativo
# ---------------------------------------------------------------------------
def _relative_time(dt) -> str:
    if dt is None:
        return ""
    if not hasattr(dt, "tzinfo") or dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt
    secs = int(delta.total_seconds())
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
            ORDER BY COALESCE({order_col}, 0) DESC, ws.rating_average DESC
            LIMIT %s
            """,
            (limit,),
        )
        for i, w in enumerate(works, start=1):
            w["position"] = i
            w["reads_formatted"] = _fmt_views(int(w.get(col_key, 0) or 0))
            w["badge"] = w.get("format_name") or ""
            w["href"] = f"/pages/obra.html?slug={w['slug']}"
            w["rating"] = float(w.get("rating_average") or 0)
        await self._attach_genres(works)
        return works

    # -----------------------------------------------------------------------
    # Populares Esta Semana
    # -----------------------------------------------------------------------
    async def get_popular(self, limit: int = 4) -> List[Dict]:
        works = await self._fetch(
            f"""
            {WORK_BASE}
            ORDER BY COALESCE(ws.weekly_views, 0) DESC,
                     COALESCE(ws.favorites_count, 0) DESC
            LIMIT %s
            """,
            (limit,),
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
                    "chapter_href": f"/pages/leer.html?chapter_id={r['chapter_id']}",
                }
            )
        return result

    # -----------------------------------------------------------------------
    # Misión Diaria — una sola query con JOIN
    # -----------------------------------------------------------------------
    async def get_mission(self, user_id: int) -> Dict[str, Any]:
        rows = await self._fetch(
            """
            SELECT u.coins, u.xp, u.streak_days,
                   COUNT(DISTINCT rh.chapter_id) AS chapters_read
            FROM users AS u
            LEFT JOIN reading_history AS rh
                   ON rh.user_id = u.id AND DATE(rh.read_at) = CURDATE()
            WHERE u.id = %s
            GROUP BY u.id, u.coins, u.xp, u.streak_days
            """,
            (user_id,),
        )
        row = rows[0] if rows else {}
        chapters_read = int(row.get("chapters_read") or 0)
        pct = min(100, int((chapters_read / MISSION_DAILY_CHAPTERS) * 100))

        return {
            "description": "Lee 3 capítulos diarios y desbloquea el cofre acumulado semanal de llaves doradas.",
            "progress_pct": pct,
            "progress_label": f"Progreso hoy ({chapters_read}/{MISSION_DAILY_CHAPTERS} capítulos)",
            "current": chapters_read,
            "total": MISSION_DAILY_CHAPTERS,
            "streak_days": int(row.get("streak_days") or 0),
            "coins": int(row.get("coins") or 0),
            "xp": int(row.get("xp") or 0),
        }

    # -----------------------------------------------------------------------
    # Chat reciente
    # -----------------------------------------------------------------------
    async def get_recent_chat(self) -> List[Dict[str, Any]]:
        rows = await self._fetch("""
            SELECT hc.content, hc.pinned, hc.created_at,
                   u.username, u.platform_role, u.xp
            FROM home_chats AS hc
            JOIN users AS u ON u.id = hc.user_id
            ORDER BY hc.pinned DESC, hc.created_at DESC
            LIMIT 20
            """)

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
                    "username": r["username"],
                    "role": role_key,
                    "role_label": role_label,
                    "level": f"NV. {level}",
                    "created_text": _relative_time(r["created_at"]),
                    "content": r["content"],
                    "pinned": bool(r["pinned"]),
                }
            )
        return result
