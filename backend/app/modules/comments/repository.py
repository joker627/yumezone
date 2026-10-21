from typing import Any, Dict, List, Optional
import aiomysql


class CommentRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def list_comments(
        self, work_id: int, chapter_id: Optional[int], limit: int
    ) -> List[Dict[str, Any]]:
        chapter_filter = "AND c.chapter_id = %s" if chapter_id else "AND c.chapter_id IS NULL"
        values = (work_id, chapter_id, limit) if chapter_id else (work_id, limit)
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                f"""
                SELECT c.id, c.work_id, c.chapter_id, c.parent_id, c.content, c.contains_spoiler,
                       c.created_at, c.updated_at, u.id AS user_id, u.username, u.avatar_url,
                       u.anillo_url, u.anillo_url AS avatar_frame_url,
                       COALESCE(cr_agg.likes, 0) AS likes,
                       COALESCE(cr_agg.dislikes, 0) AS dislikes
                FROM comments c
                JOIN users u ON u.id = c.user_id
                LEFT JOIN (
                    SELECT comment_id,
                           SUM(reaction = 'LIKE') AS likes,
                           SUM(reaction = 'DISLIKE') AS dislikes
                    FROM comment_reactions
                    GROUP BY comment_id
                ) cr_agg ON cr_agg.comment_id = c.id
                WHERE c.work_id = %s AND c.status = 'VISIBLE' {chapter_filter}
                ORDER BY c.created_at DESC LIMIT %s
                """,
                values,
            )
            return await cur.fetchall()

    async def get_comment(self, comment_id: int) -> Optional[Dict[str, Any]]:
        async with self.conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, user_id, status FROM comments WHERE id = %s",
                (comment_id,),
            )
            return await cur.fetchone()

    async def check_chapter_exists(self, chapter_id: int, work_id: int) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "SELECT 1 FROM chapters WHERE id = %s AND work_id = %s AND status = 'PUBLISHED'",
                (chapter_id, work_id),
            )
            return await cur.fetchone() is not None

    async def check_parent_exists(
        self, parent_id: int, work_id: int, chapter_id: Optional[int]
    ) -> bool:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "SELECT 1 FROM comments WHERE id = %s AND work_id = %s AND chapter_id <=> %s",
                (parent_id, work_id, chapter_id),
            )
            return await cur.fetchone() is not None

    async def create_comment(
        self,
        work_id: int,
        chapter_id: Optional[int],
        user_id: int,
        parent_id: Optional[int],
        content: str,
        contains_spoiler: bool,
    ) -> int:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO comments (work_id, chapter_id, user_id, parent_id, content, contains_spoiler)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (work_id, chapter_id, user_id, parent_id, content, contains_spoiler),
            )
            return cur.lastrowid

    async def update_comment(
        self, comment_id: int, content: str, contains_spoiler: bool
    ) -> None:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "UPDATE comments SET content = %s, contains_spoiler = %s WHERE id = %s",
                (content, contains_spoiler, comment_id),
            )

    async def delete_comment(self, comment_id: int) -> None:
        async with self.conn.cursor() as cur:
            await cur.execute(
                "UPDATE comments SET status = 'DELETED', content = '' WHERE id = %s",
                (comment_id,),
            )

    async def set_reaction(self, comment_id: int, user_id: int, reaction: str) -> None:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO comment_reactions (comment_id, user_id, reaction)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)
                """,
                (comment_id, user_id, reaction),
            )

    async def create_report(
        self, reporter_user_id: int, comment_id: int, reason: str, details: Optional[str]
    ) -> int:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO content_reports (reporter_user_id, entity_type, entity_id, reason, details)
                VALUES (%s, 'COMMENT', %s, %s, %s)
                """,
                (reporter_user_id, comment_id, reason, details),
            )
            return cur.lastrowid
