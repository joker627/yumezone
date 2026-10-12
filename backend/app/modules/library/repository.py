from typing import Optional, List

import aiomysql


class LibraryRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def get_notification_preference(
        self, user_id: int, work_id: int
    ) -> Optional[bool]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT notify_new_chapters
                FROM user_library
                WHERE user_id = %s AND work_id = %s
                """,
                (user_id, work_id),
            )
            row = await cur.fetchone()
            return bool(row["notify_new_chapters"]) if row else None

    async def list_for_user(
        self, user_id: int, work_id: Optional[int] = None
    ) -> list[dict]:
        work_filter = " AND w.id = %s" if work_id is not None else ""
        values = (user_id, work_id) if work_id is not None else (user_id,)
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                f"""
                SELECT w.id, w.title, w.slug, w.alternative_title, w.synopsis,
                       w.author, w.cover_url, w.banner_url, w.status_id,
                       w.format_id, w.demographic_id, w.scan_group_id,
                       COALESCE(ws.total_views, 0) AS total_views,
                       COALESCE(ws.rating_average, 0) AS rating_average,
                       COALESCE(ws.rating_count, 0) AS rating_count,
                       COALESCE(ws.followers_count, 0) AS followers_count,
                       COALESCE(ws.favorites_count, 0) AS favorites_count,
                       COALESCE(ws.trending_score, 0) AS trending_score,
                       (SELECT c.id FROM chapters AS c
                        WHERE c.work_id = w.id AND c.status = 'PUBLISHED'
                        ORDER BY c.chapter_number ASC, c.published_at ASC
                        LIMIT 1) AS first_chapter_id,
                       COALESCE(ul.status, 'FOLLOWING') AS library_status,
                       ul.rating,
                       COALESCE(ul.notify_new_chapters, TRUE) AS notify_new_chapters,
                       ul.added_at,
                       rh.chapter_id AS last_chapter_id,
                       rh_c.chapter_number AS last_chapter_number,
                       rh.last_page_read,
                       rh.read_at AS last_read_at,
                       COALESCE(rh_ci.total_pages, 0) AS last_chapter_total_pages
                FROM user_library AS ul
                JOIN works AS w ON w.id = ul.work_id
                LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                LEFT JOIN reading_history AS rh ON rh.user_id = ul.user_id AND rh.work_id = ul.work_id
                LEFT JOIN chapters AS rh_c ON rh_c.id = rh.chapter_id
                LEFT JOIN (
                    SELECT chapter_id, COUNT(*) AS total_pages
                    FROM chapter_images
                    GROUP BY chapter_id
                ) AS rh_ci ON rh_ci.chapter_id = rh.chapter_id
                WHERE ul.user_id = %s
                {work_filter}
                ORDER BY ul.added_at DESC, w.title ASC
                """,
                values,
            )
            rows = await cur.fetchall()
            items = []
            for r in rows:
                reading_progress = None
                if r.get("last_chapter_id") is not None:
                    chap_num = float(r.get("last_chapter_number") or 1)
                    chap_str = str(int(chap_num)) if chap_num.is_integer() else f"{chap_num:.1f}"
                    last_page = int(r.get("last_page_read") or 1)
                    tot_pages = int(r.get("last_chapter_total_pages") or 0)
                    pct = round((last_page / tot_pages) * 100) if tot_pages > 0 else 0
                    reading_progress = {
                        "chapter_id": r["last_chapter_id"],
                        "chapter_number": chap_num,
                        "chapter_text": f"Cap. {chap_str}",
                        "last_page_read": last_page,
                        "total_pages": tot_pages,
                        "page_text": f"Pág. {last_page}/{tot_pages}" if tot_pages else "",
                        "progress_pct": pct,
                        "read_at": r.get("last_read_at"),
                        "reader_url": f"/pages/leer.html?slug={r['slug']}&chapter_id={r['last_chapter_id']}",
                    }
                r["reading_progress"] = reading_progress
                items.append(r)
            return items

    async def get_for_user(self, user_id: int, work_id: int) -> Optional[dict]:
        items = await self.list_for_user(user_id, work_id)
        return items[0] if items else None

    async def work_exists(self, work_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute("SELECT 1 FROM works WHERE id = %s", (work_id,))
            return await cur.fetchone() is not None

    async def add_work(self, user_id: int, work_id: int, status: str) -> None:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO user_library (user_id, work_id, status, notify_new_chapters)
                VALUES (%s, %s, %s, TRUE)
                ON DUPLICATE KEY UPDATE status = VALUES(status), notify_new_chapters = TRUE
                """,
                (user_id, work_id, status),
            )
            await cur.execute(
                """
                UPDATE work_statistics
                SET favorites_count = (SELECT COUNT(*) FROM user_library WHERE work_id = %s)
                WHERE work_id = %s
                """,
                (work_id, work_id),
            )
            await self.conn.commit()

    async def update_status(self, user_id: int, work_id: int, status: str) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE user_library
                SET status = %s
                WHERE user_id = %s AND work_id = %s
                """,
                (status, user_id, work_id),
            )
            await self.conn.commit()
            await cur.execute(
                "SELECT 1 FROM user_library WHERE user_id = %s AND work_id = %s",
                (user_id, work_id),
            )
            return await cur.fetchone() is not None

    async def remove_work(self, user_id: int, work_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM user_library WHERE user_id = %s AND work_id = %s",
                (user_id, work_id),
            )
            await cur.execute(
                """
                UPDATE work_statistics
                SET favorites_count = (SELECT COUNT(*) FROM user_library WHERE work_id = %s)
                WHERE work_id = %s
                """,
                (work_id, work_id),
            )
            await self.conn.commit()
            return cur.rowcount > 0

    async def update_notification_preference(
        self, user_id: int, work_id: int, notify_new_chapters: bool
    ) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE user_library
                SET notify_new_chapters = %s
                WHERE user_id = %s AND work_id = %s
                """,
                (notify_new_chapters, user_id, work_id),
            )
            await self.conn.commit()
            await cur.execute(
                """
                SELECT 1
                FROM user_library
                WHERE user_id = %s AND work_id = %s
                """,
                (user_id, work_id),
            )
            return await cur.fetchone() is not None

    async def save_reading_history(self, user_id: int, work_id: int, chapter_id: int, page: int) -> None:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO reading_history (user_id, work_id, chapter_id, last_page_read)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                chapter_id = VALUES(chapter_id),
                last_page_read = VALUES(last_page_read),
                read_at = CURRENT_TIMESTAMP
                """,
                (user_id, work_id, chapter_id, page),
            )
            # Solo marcar el capítulo como completado/leído si ha alcanzado el 80% o la última página
            await cur.execute("SELECT COUNT(*) FROM chapter_images WHERE chapter_id = %s", (chapter_id,))
            row = await cur.fetchone()
            total_pages = int(row[0]) if row and row[0] else 1
            if total_pages > 0 and (page >= total_pages or page >= max(1, int(total_pages * 0.8))):
                await cur.execute(
                    """
                    INSERT IGNORE INTO user_read_chapters (user_id, work_id, chapter_id)
                    VALUES (%s, %s, %s)
                    """,
                    (user_id, work_id, chapter_id),
                )
            await self.conn.commit()

    async def get_user_read_chapters(self, user_id: int, work_id: int) -> List[int]:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                SELECT chapter_id
                FROM user_read_chapters
                WHERE user_id = %s AND work_id = %s
                """,
                (user_id, work_id),
            )
            rows = await cur.fetchall()
            return [int(r[0]) for r in rows]

    async def toggle_chapter_read(self, user_id: int, chapter_id: int) -> dict:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("SELECT work_id, chapter_number FROM chapters WHERE id = %s", (chapter_id,))
            ch = await cur.fetchone()
            if not ch:
                raise ValueError("Capítulo no encontrado")
            work_id = int(ch["work_id"])

            await cur.execute(
                "SELECT 1 FROM user_read_chapters WHERE user_id = %s AND chapter_id = %s",
                (user_id, chapter_id),
            )
            already_read = await cur.fetchone() is not None

            if already_read:
                await cur.execute(
                    "DELETE FROM user_read_chapters WHERE user_id = %s AND chapter_id = %s",
                    (user_id, chapter_id),
                )
                is_read = False
            else:
                await cur.execute(
                    """
                    INSERT INTO user_read_chapters (user_id, work_id, chapter_id)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
                    """,
                    (user_id, work_id, chapter_id),
                )
                # Actualizar también reading_history
                await cur.execute(
                    """
                    INSERT INTO reading_history (user_id, work_id, chapter_id, last_page_read)
                    VALUES (%s, %s, %s, 1)
                    ON DUPLICATE KEY UPDATE
                        chapter_id = VALUES(chapter_id),
                        read_at = CURRENT_TIMESTAMP
                    """,
                    (user_id, work_id, chapter_id),
                )
                is_read = True

            await self.conn.commit()

            await cur.execute(
                "SELECT COUNT(*) as cnt FROM user_read_chapters WHERE user_id = %s AND work_id = %s",
                (user_id, work_id),
            )
            cnt_row = await cur.fetchone()
            read_count = int(cnt_row["cnt"]) if cnt_row else 0

            return {
                "chapter_id": chapter_id,
                "work_id": work_id,
                "is_read": is_read,
                "read_count": read_count,
            }

    async def get_chapter_page_count(self, work_id: int, chapter_id: int) -> Optional[int]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT COUNT(ci.id) AS total_pages
                FROM chapters AS c
                LEFT JOIN chapter_images AS ci ON ci.chapter_id = c.id
                WHERE c.id = %s AND c.work_id = %s
                GROUP BY c.id
                """,
                (chapter_id, work_id),
            )
            row = await cur.fetchone()
            return int(row["total_pages"]) if row is not None else None

    async def set_work_rating(self, user_id: int, work_id: int, rating: float) -> dict:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO user_library (user_id, work_id, status, rating)
                VALUES (%s, %s, 'FOLLOWING', %s)
                ON DUPLICATE KEY UPDATE rating = VALUES(rating)
                """,
                (user_id, work_id, rating),
            )
            await cur.execute(
                """
                INSERT INTO work_statistics (work_id, rating_average, rating_count)
                VALUES (%s, %s, 1)
                ON DUPLICATE KEY UPDATE
                    rating_average = (SELECT ROUND(AVG(ul.rating), 2) FROM user_library AS ul WHERE ul.work_id = %s AND ul.rating IS NOT NULL),
                    rating_count = (SELECT COUNT(ul.rating) FROM user_library AS ul WHERE ul.work_id = %s AND ul.rating IS NOT NULL)
                """,
                (work_id, rating, work_id, work_id),
            )
            await self.conn.commit()

        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT COALESCE(rating_average, 0.0) AS rating_average,
                       COALESCE(rating_count, 0) AS rating_count
                FROM work_statistics
                WHERE work_id = %s
                """,
                (work_id,),
            )
            row = await cur.fetchone() or {"rating_average": rating, "rating_count": 1}
            return {
                "work_id": work_id,
                "user_rating": float(rating),
                "rating_average": float(row["rating_average"]),
                "rating_count": int(row["rating_count"]),
            }

    async def get_user_work_rating(self, user_id: int, work_id: int) -> Optional[float]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT rating FROM user_library WHERE user_id = %s AND work_id = %s",
                (user_id, work_id),
            )
            row = await cur.fetchone()
            if not row or row.get("rating") is None:
                return None
            return float(row["rating"])
