import aiomysql

class MetricsRepository:
    def __init__(self, conn: aiomysql.Connection):
        self.conn = conn

    async def log_view(self, work_id: int, chapter_id: int | None, user_id: int | None, ip_address: str | None) -> None:
        async with self.conn.cursor() as cur:
            # 1. Deduplicación para usuario autenticado: evitar lecturas duplicadas
            if user_id:
                if chapter_id:
                    await cur.execute(
                        "SELECT 1 FROM view_logs WHERE user_id = %s AND work_id = %s AND chapter_id = %s LIMIT 1",
                        (user_id, work_id, chapter_id),
                    )
                else:
                    await cur.execute(
                        "SELECT 1 FROM view_logs WHERE user_id = %s AND work_id = %s AND viewed_at >= NOW() - INTERVAL 24 HOUR LIMIT 1",
                        (user_id, work_id),
                    )
                if await cur.fetchone():
                    return  # Ya registrado previamente para este usuario, evitar inflación

            # 2. Deduplicación para usuario anónimo: enfriamiento de 24 horas por IP
            elif ip_address:
                if chapter_id:
                    await cur.execute(
                        "SELECT 1 FROM view_logs WHERE ip_address = %s AND work_id = %s AND chapter_id = %s AND viewed_at >= NOW() - INTERVAL 24 HOUR LIMIT 1",
                        (ip_address, work_id, chapter_id),
                    )
                else:
                    await cur.execute(
                        "SELECT 1 FROM view_logs WHERE ip_address = %s AND work_id = %s AND viewed_at >= NOW() - INTERVAL 24 HOUR LIMIT 1",
                        (ip_address, work_id),
                    )
                if await cur.fetchone():
                    return  # Ya registrado recientemente para esta IP, evitar inflación

            # 3. Inserción solo si es una lectura legítima no duplicada
            await cur.execute(
                """
                INSERT INTO view_logs (work_id, chapter_id, user_id, ip_address)
                VALUES (%s, %s, %s, %s)
                """,
                (work_id, chapter_id, user_id, ip_address),
            )
            # Actualización inmediata en tiempo real de estadísticas de la obra mediante incrementos atómicos O(1)
            await cur.execute(
                """
                INSERT INTO work_statistics (
                    work_id, total_views, daily_views, weekly_views, monthly_views, trending_score
                )
                VALUES (%s, 1, 1, 1, 1, 1.00)
                ON DUPLICATE KEY UPDATE
                    total_views = COALESCE(total_views, 0) + 1,
                    daily_views = COALESCE(daily_views, 0) + 1,
                    weekly_views = COALESCE(weekly_views, 0) + 1,
                    monthly_views = COALESCE(monthly_views, 0) + 1,
                    trending_score = COALESCE(trending_score, 0) + 1.00
                """,
                (work_id,),
            )
            await self.conn.commit()

    async def has_valid_target(self, work_id: int, chapter_id: int | None) -> bool:
        async with self.conn.cursor() as cur:
            if chapter_id is None:
                await cur.execute("SELECT 1 FROM works WHERE id = %s", (work_id,))
            else:
                await cur.execute(
                    "SELECT 1 FROM chapters WHERE id = %s AND work_id = %s",
                    (chapter_id, work_id),
                )
            return await cur.fetchone() is not None

    async def compute_statistics(self) -> None:
        async with self.conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO work_statistics (work_id, total_views, daily_views, weekly_views, monthly_views, trending_score)
                SELECT
                    w.id,
                    COALESCE(SUM(CASE WHEN vl.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_views,
                    COALESCE(SUM(CASE WHEN vl.viewed_at >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END), 0) AS daily_views,
                    COALESCE(SUM(CASE WHEN vl.viewed_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END), 0) AS weekly_views,
                    COALESCE(SUM(CASE WHEN vl.viewed_at >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END), 0) AS monthly_views,
                    (
                        COALESCE(SUM(CASE WHEN vl.viewed_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END), 0) * 3.0 +
                        COALESCE(SUM(CASE WHEN vl.id IS NOT NULL THEN 1 ELSE 0 END), 0) * 1.0 +
                        (SELECT COUNT(*) FROM user_library ul WHERE ul.work_id = w.id) * 5.0 +
                        COALESCE((SELECT ROUND(AVG(ul.rating), 2) FROM user_library ul WHERE ul.work_id = w.id AND ul.rating IS NOT NULL), 0.0) *
                        (SELECT COUNT(ul.rating) FROM user_library ul WHERE ul.work_id = w.id AND ul.rating IS NOT NULL) * 2.0
                    ) AS trending_score
                FROM works w
                LEFT JOIN view_logs vl ON vl.work_id = w.id
                GROUP BY w.id
                ON DUPLICATE KEY UPDATE
                    total_views = VALUES(total_views),
                    daily_views = VALUES(daily_views),
                    weekly_views = VALUES(weekly_views),
                    monthly_views = VALUES(monthly_views),
                    trending_score = VALUES(trending_score)
                """
            )
            await self.conn.commit()
