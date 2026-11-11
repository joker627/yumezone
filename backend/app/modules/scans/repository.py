from typing import List, Optional
from sqlalchemy import bindparam, delete, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import resolve_session
from app.modules.home.models import AnnouncementORM
from app.modules.shop.models import UserCoinTransactionORM
from app.modules.scans.models import (
    ScanFundingGoalORM,
    ScanGroupMemberORM,
    ScanGroupORM,
    ScanRoleORM,
    ScanTreasuryTransactionORM,
)
from app.modules.users.models import UserORM
from app.modules.scans.schemas import ScanGroup, ScanGroupMember
from app.utils.formatters import parse_json_safe


class ScanGroupRepository:
    def __init__(self, conn: Optional[AsyncSession] = None):
        self.conn = conn

    async def create_group(
        self, group: ScanGroup, owner_user_id: Optional[int] = None
    ) -> ScanGroup:
        async with resolve_session(self.conn) as session:
            new_group = ScanGroupORM(
                name=group.name,
                slug=group.slug,
                description=group.description,
                logo_url=group.logo_url,
                banner_url=group.banner_url,
                owner_user_id=owner_user_id,
            )
            session.add(new_group)
            await session.commit()
            group.id = new_group.id
        return group

    async def get_group_by_id(self, group_id: int) -> Optional[ScanGroup]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT sg.*,
                           (SELECT COUNT(*) FROM works WHERE scan_group_id = sg.id) AS works_count,
                           (SELECT COUNT(*) FROM chapters WHERE scan_group_id = sg.id) AS chapters_count,
                           (SELECT COUNT(*) FROM scan_group_members WHERE group_id = sg.id) AS members_count
                    FROM scan_groups sg
                    WHERE sg.id = :gid
                    """
                ),
                {"gid": group_id},
            )
            r = res.mappings().first()
            if r:
                row = dict(r)
                sl = row.get("social_links")
                rm = row.get("report_methods")
                row["social_links"] = (
                    sl if isinstance(sl, dict) else parse_json_safe(sl, {})
                )
                row["report_methods"] = (
                    rm if isinstance(rm, dict) else parse_json_safe(rm, {})
                )
                return ScanGroup(**row)
        return None

    async def update_group(self, group: ScanGroup) -> ScanGroup:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(ScanGroupORM)
                .where(ScanGroupORM.id == group.id)
                .values(
                    name=group.name,
                    slug=group.slug,
                    description=group.description,
                    logo_url=group.logo_url,
                    banner_url=group.banner_url,
                    social_links=group.social_links or None,
                    report_methods=group.report_methods or None,
                    status=group.status,
                )
            )
            await session.commit()
        return group

    async def delete_group(self, group_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(ScanGroupORM)
                .where(ScanGroupORM.id == group_id)
                .values(status="DELETED")
            )
            await session.commit()
        return True

    async def add_member(self, member: ScanGroupMember) -> None:
        async with resolve_session(self.conn) as session:
            session.add(
                ScanGroupMemberORM(
                    group_id=member.group_id,
                    user_id=member.user_id,
                    role=member.role,
                    permissions=member.permissions or None,
                )
            )
            await session.commit()

    async def get_member(
        self, group_id: int, user_id: int
    ) -> Optional[ScanGroupMember]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(ScanGroupMemberORM).where(
                    ScanGroupMemberORM.group_id == group_id,
                    ScanGroupMemberORM.user_id == user_id,
                )
            )
            m = res.scalar_one_or_none()
            if m:
                row = m.to_dict()
                p = row.get("permissions")
                row["permissions"] = (
                    p if isinstance(p, dict) else parse_json_safe(p, {})
                )
                return ScanGroupMember(**row)
        return None

    async def get_group_members(self, group_id: int) -> List[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT
                        m.group_id,
                        m.user_id,
                        u.username,
                        u.user_code,
                        u.avatar_url,
                        u.avatar_frame_url,
                        m.role,
                        COALESCE(sr.name, m.role) AS role_name,
                        m.permissions,
                        m.joined_at
                    FROM scan_group_members m
                    JOIN users u ON m.user_id = u.id
                    LEFT JOIN scan_roles sr ON m.role = sr.code
                    WHERE m.group_id = :gid
                    ORDER BY COALESCE(sr.id, 99) ASC, m.joined_at ASC
                    """
                ),
                {"gid": group_id},
            )
            rows = [dict(r) for r in res.mappings().all()]
            for row in rows:
                p = row.get("permissions")
                row["permissions"] = (
                    p if isinstance(p, dict) else parse_json_safe(p, {})
                )
            return rows

    async def find_user_by_identifier(
        self, identifier: str
    ) -> Optional[dict]:
        clean = (identifier or "").strip().lstrip("@")
        if not clean:
            return None
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    UserORM.id,
                    UserORM.username,
                    UserORM.user_code,
                    UserORM.email,
                    UserORM.avatar_url,
                    UserORM.avatar_frame_url,
                )
                .where(
                    or_(
                        UserORM.username == clean,
                        UserORM.user_code == clean,
                        UserORM.email == clean,
                    )
                )
                .limit(1)
            )
            row = res.mappings().first()
            return dict(row) if row else None

    async def get_user_membership(self, user_id: int) -> Optional[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    ScanGroupMemberORM.group_id,
                    ScanGroupMemberORM.user_id,
                    ScanGroupMemberORM.role,
                    ScanGroupMemberORM.permissions,
                    ScanGroupORM.name.label("group_name"),
                    ScanGroupORM.status.label("group_status"),
                )
                .join(
                    ScanGroupORM,
                    ScanGroupMemberORM.group_id == ScanGroupORM.id,
                )
                .where(
                    ScanGroupMemberORM.user_id == user_id,
                    ScanGroupORM.status == "ACTIVE",
                )
                .limit(1)
            )
            row = res.mappings().first()
            return dict(row) if row else None

    async def update_member(
        self,
        group_id: int,
        user_id: int,
        role: str,
        permissions: dict,
    ) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                update(ScanGroupMemberORM)
                .where(
                    ScanGroupMemberORM.group_id == group_id,
                    ScanGroupMemberORM.user_id == user_id,
                )
                .values(role=role, permissions=permissions or None)
            )
            await session.commit()

    async def remove_member(self, group_id: int, user_id: int) -> None:
        async with resolve_session(self.conn) as session:
            await session.execute(
                delete(ScanGroupMemberORM).where(
                    ScanGroupMemberORM.group_id == group_id,
                    ScanGroupMemberORM.user_id == user_id,
                )
            )
            await session.commit()

    @staticmethod
    def _enrich_scan_prestige(row: dict) -> dict:
        level = max(1, int(row.get("clan_level") or 1))
        vault_tokens = max(0, int(row.get("vault_tokens") or 0))
        total_tokens = max(0, int(row.get("total_contributed_tokens") or 0))
        next_upgrade_cost = level * 40
        progress_pct = min(
            100, round((vault_tokens / max(1, next_upgrade_cost)) * 100)
        )
        remaining_tokens = max(0, next_upgrade_cost - vault_tokens)

        if level >= 10:
            rank_code, rank_title = "RANGO S", "Scan Leyenda"
        elif level >= 5:
            rank_code, rank_title = "RANGO A", "Scan Élite"
        elif level >= 3:
            rank_code, rank_title = "RANGO B", "Scan Veterano"
        else:
            rank_code, rank_title = "RANGO C", "Scan Emergente"

        row["clan_level"] = level
        row["vault_tokens"] = vault_tokens
        row["total_contributed_tokens"] = total_tokens
        row["next_upgrade_cost"] = next_upgrade_cost
        row["progress_pct"] = progress_pct
        row["remaining_tokens"] = remaining_tokens
        row["rank_code"] = rank_code
        row["rank_title"] = rank_title
        return row

    async def get_public_scans_list(self) -> List[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT
                        sg.id,
                        sg.name,
                        sg.slug,
                        sg.logo_url,
                        sg.banner_url,
                        sg.description,
                        sg.social_links,
                        sg.report_methods,
                        sg.status,
                        COALESCE(sg.vault_tokens, 0) AS vault_tokens,
                        COALESCE(sg.total_contributed_tokens, 0) AS total_contributed_tokens,
                        COALESCE(sg.clan_level, 1) AS clan_level,
                        sg.created_at,
                        COALESCE(w_count.works_count, 0) AS works_count,
                        COALESCE(c_count.chapters_count, 0) AS chapters_count,
                        COALESCE(m_count.members_count, 0) AS members_count,
                        u.username AS owner_username,
                        u.avatar_url AS owner_avatar_url
                    FROM scan_groups sg
                    LEFT JOIN users u ON sg.owner_user_id = u.id
                    LEFT JOIN (
                        SELECT scan_group_id, COUNT(*) AS works_count
                        FROM works
                        WHERE scan_group_id IS NOT NULL
                        GROUP BY scan_group_id
                    ) w_count ON sg.id = w_count.scan_group_id
                    LEFT JOIN (
                        SELECT scan_group_id, COUNT(*) AS chapters_count
                        FROM chapters
                        WHERE scan_group_id IS NOT NULL
                        GROUP BY scan_group_id
                    ) c_count ON sg.id = c_count.scan_group_id
                    LEFT JOIN (
                        SELECT group_id, COUNT(*) AS members_count
                        FROM scan_group_members
                        GROUP BY group_id
                    ) m_count ON sg.id = m_count.group_id
                    WHERE sg.status = 'ACTIVE'
                    ORDER BY chapters_count DESC, works_count DESC
                    """
                )
            )
            rows = [dict(r) for r in res.mappings().all()]
            for r in rows:
                sl = r.get("social_links")
                rm = r.get("report_methods")
                r["social_links"] = (
                    sl if isinstance(sl, dict) else parse_json_safe(sl, {})
                )
                r["report_methods"] = (
                    rm if isinstance(rm, dict) else parse_json_safe(rm, {})
                )
                self._enrich_scan_prestige(r)
            return rows

    async def get_public_scan_by_slug(self, slug: str) -> Optional[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT
                        sg.id,
                        sg.name,
                        sg.slug,
                        sg.logo_url,
                        sg.banner_url,
                        sg.description,
                        sg.social_links,
                        sg.report_methods,
                        sg.status,
                        COALESCE(sg.vault_tokens, 0) AS vault_tokens,
                        COALESCE(sg.total_contributed_tokens, 0) AS total_contributed_tokens,
                        COALESCE(sg.clan_level, 1) AS clan_level,
                        sg.created_at,
                        (SELECT COUNT(*) FROM works WHERE scan_group_id = sg.id) AS works_count,
                        (SELECT COUNT(*) FROM chapters WHERE scan_group_id = sg.id) AS chapters_count,
                        (SELECT COUNT(*) FROM scan_group_members WHERE group_id = sg.id) AS members_count,
                        u.username AS owner_username,
                        u.avatar_url AS owner_avatar_url
                    FROM scan_groups sg
                    LEFT JOIN users u ON sg.owner_user_id = u.id
                    WHERE sg.slug = :slug AND sg.status = 'ACTIVE'
                    """
                ),
                {"slug": slug},
            )
            r = res.mappings().first()
            if not r:
                return None
            row = dict(r)
            sl = row.get("social_links")
            rm = row.get("report_methods")
            row["social_links"] = (
                sl if isinstance(sl, dict) else parse_json_safe(sl, {})
            )
            row["report_methods"] = (
                rm if isinstance(rm, dict) else parse_json_safe(rm, {})
            )
            return self._enrich_scan_prestige(row)

    async def get_all_roles(self) -> List[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    ScanRoleORM.id, ScanRoleORM.code, ScanRoleORM.name
                ).order_by(ScanRoleORM.id.asc())
            )
            return [dict(r) for r in res.mappings().all()]

    async def get_scan_works(self, scan_group_id: int) -> List[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT
                        w.id,
                        w.title,
                        w.slug,
                        w.alternative_title,
                        w.author,
                        w.cover_url,
                        w.banner_url,
                        w.synopsis,
                        w.status_id,
                        w.format_id,
                        w.demographic_id,
                        COALESCE(s.name, 'En emisión') AS status,
                        COALESCE(s.name, 'En emisión') AS status_name,
                        COALESCE(f.name, 'Manga') AS format,
                        COALESCE(f.name, 'Manga') AS format_name,
                        COALESCE(d.name, 'Shonen') AS demographic_name,
                        COALESCE(ws.rating_average, 0.0) AS score,
                        COALESCE(ws.total_views, 0) AS total_views,
                        COALESCE(ws.views_last_24h, 0) AS views_last_24h,
                        COALESCE(ws.favorites_count, 0) AS favorites_count,
                        ws.latest_chapter_number,
                        ws.last_published_at,
                        COALESCE(c_count.chapters_count, 0) AS chapters_count,
                        COALESCE(c_count.published_count, 0) AS published_count,
                        COALESCE(c_count.scheduled_count, 0) AS scheduled_count,
                        COALESCE(c_count.draft_count, 0) AS draft_count
                    FROM works w
                    LEFT JOIN statuses s ON w.status_id = s.id
                    LEFT JOIN formats f ON w.format_id = f.id
                    LEFT JOIN demographics d ON w.demographic_id = d.id
                    LEFT JOIN work_statistics ws ON w.id = ws.work_id
                    LEFT JOIN (
                        SELECT
                            work_id,
                            COUNT(*) AS chapters_count,
                            SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) AS published_count,
                            SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) AS scheduled_count,
                            SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS draft_count
                        FROM chapters
                        GROUP BY work_id
                    ) c_count ON w.id = c_count.work_id
                    WHERE w.scan_group_id = :sgid
                    ORDER BY w.updated_at DESC, score DESC
                    """
                ),
                {"sgid": scan_group_id},
            )
            works = [dict(r) for r in res.mappings().all()]
            if works:
                work_ids = [w["id"] for w in works]
                g_stmt = text(
                    """
                    SELECT wg.work_id, g.id AS genre_id, g.name AS genre_name
                    FROM work_genres wg
                    JOIN genres g ON wg.genre_id = g.id
                    WHERE wg.work_id IN :wids
                    ORDER BY g.name ASC
                    """
                ).bindparams(bindparam("wids", expanding=True))
                g_res = await session.execute(g_stmt, {"wids": work_ids})
                genre_map: dict[int, dict[str, list]] = {}
                for gr in g_res.mappings().all():
                    wid = gr["work_id"]
                    if wid not in genre_map:
                        genre_map[wid] = {"ids": [], "names": []}
                    genre_map[wid]["ids"].append(gr["genre_id"])
                    genre_map[wid]["names"].append(gr["genre_name"])
                for w in works:
                    gdata = genre_map.get(w["id"], {"ids": [], "names": []})
                    w["genre_ids"] = gdata["ids"]
                    w["genres"] = gdata["names"]
            return works

    async def get_public_scan_members(self, scan_group_id: int) -> List[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT
                        m.user_id,
                        u.username,
                        u.user_code,
                        u.avatar_url,
                        u.avatar_frame_url,
                        m.role AS role_code,
                        COALESCE(sr.name, m.role) AS role_name,
                        m.joined_at
                    FROM scan_group_members m
                    JOIN users u ON m.user_id = u.id
                    LEFT JOIN scan_roles sr ON m.role = sr.code
                    WHERE m.group_id = :gid
                    ORDER BY COALESCE(sr.id, 99) ASC, m.joined_at ASC
                    """
                ),
                {"gid": scan_group_id},
            )
            return [dict(r) for r in res.mappings().all()]

    async def get_user_scan(self, user_id: int) -> Optional[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                text(
                    """
                    SELECT
                        sg.id,
                        sg.name,
                        sg.slug,
                        sg.logo_url,
                        sg.banner_url,
                        sg.description,
                        sg.social_links,
                        sg.report_methods,
                        sg.status,
                        COALESCE(sg.vault_tokens, 0) AS vault_tokens,
                        COALESCE(sg.total_contributed_tokens, 0) AS total_contributed_tokens,
                        COALESCE(sg.clan_level, 1) AS clan_level,
                        sg.created_at,
                        m.role AS role_code,
                        COALESCE(sr.name, m.role) AS role_name,
                        m.permissions,
                        m.joined_at,
                        COALESCE(w_count.works_count, 0) AS works_count,
                        COALESCE(c_count.chapters_count, 0) AS chapters_count,
                        COALESCE(m_count.members_count, 0) AS members_count
                    FROM scan_group_members m
                    JOIN scan_groups sg ON m.group_id = sg.id
                    LEFT JOIN scan_roles sr ON m.role = sr.code
                    LEFT JOIN (
                        SELECT scan_group_id, COUNT(*) AS works_count FROM works GROUP BY scan_group_id
                    ) w_count ON sg.id = w_count.scan_group_id
                    LEFT JOIN (
                        SELECT scan_group_id, COUNT(*) AS chapters_count FROM chapters GROUP BY scan_group_id
                    ) c_count ON sg.id = c_count.scan_group_id
                    LEFT JOIN (
                        SELECT group_id, COUNT(*) AS members_count FROM scan_group_members GROUP BY group_id
                    ) m_count ON sg.id = m_count.group_id
                    WHERE m.user_id = :uid AND sg.status = 'ACTIVE'
                    LIMIT 1
                    """
                ),
                {"uid": user_id},
            )
            r = res.mappings().first()
            if not r:
                return None
            row = dict(r)
            sl = row.get("social_links")
            rm = row.get("report_methods")
            pm = row.get("permissions")
            row["social_links"] = (
                sl if isinstance(sl, dict) else parse_json_safe(sl, {})
            )
            row["report_methods"] = (
                rm if isinstance(rm, dict) else parse_json_safe(rm, {})
            )
            row["permissions"] = (
                pm if isinstance(pm, dict) else parse_json_safe(pm, {})
            )
            role = str(row.get("role_code") or "").upper()
            perms = (
                row.get("permissions")
                if isinstance(row.get("permissions"), dict)
                else {}
            )
            is_leader = role == "LEADER"
            can_manage = (
                is_leader
                or (role == "CO_LEADER")
                or bool(
                    perms.get("can_manage_members")
                    or perms.get("can_edit_group")
                )
            )
            if is_leader:
                can_upload = True
            elif "can_upload" in perms:
                can_upload = bool(perms.get("can_upload"))
            else:
                can_upload = role in ("CO_LEADER", "UPLOADER")
            row["is_leader"] = is_leader
            row["can_manage"] = can_manage
            row["can_upload"] = can_upload
            return self._enrich_scan_prestige(row)

    async def get_scan_treasury(
        self, group_id: int, user_id: Optional[int] = None
    ) -> dict:
        async with resolve_session(self.conn) as session:
            g_res = await session.execute(
                select(
                    ScanGroupORM.id,
                    ScanGroupORM.name,
                    ScanGroupORM.vault_tokens,
                    ScanGroupORM.total_contributed_tokens,
                    ScanGroupORM.clan_level,
                ).where(ScanGroupORM.id == group_id)
            )
            group = dict(g_res.mappings().first() or {})
            clan_level = int(group.get("clan_level") or 1)

            user_balance = {"coins": 0, "clan_tokens": 0}
            if user_id:
                ub_res = await session.execute(
                    select(UserORM.coins, UserORM.clan_tokens).where(
                        UserORM.id == user_id
                    )
                )
                ub = ub_res.mappings().first()
                if ub:
                    user_balance = {
                        "coins": int(ub.get("coins") or 0),
                        "clan_tokens": int(ub.get("clan_tokens") or 0),
                    }

            goals_res = await session.execute(
                text(
                    """
                    SELECT g.*, w.title AS work_title
                    FROM scan_funding_goals g
                    LEFT JOIN works w ON g.work_id = w.id
                    WHERE g.scan_group_id = :gid AND g.status IN ('ACTIVE', 'COMPLETED')
                    ORDER BY g.status ASC, g.created_at DESC
                    """
                ),
                {"gid": group_id},
            )
            goals = [dict(r) for r in goals_res.mappings().all()]

            tx_res = await session.execute(
                text(
                    """
                    SELECT
                        t.id,
                        t.scan_group_id,
                        t.actor_user_id,
                        u1.username AS actor_username,
                        t.target_user_id,
                        u2.username AS target_username,
                        t.amount,
                        t.balance_after,
                        t.type,
                        t.description,
                        t.reference_id,
                        t.created_at
                    FROM scan_treasury_transactions t
                    LEFT JOIN users u1 ON t.actor_user_id = u1.id
                    LEFT JOIN users u2 ON t.target_user_id = u2.id
                    WHERE t.scan_group_id = :gid
                    ORDER BY t.created_at DESC, t.id DESC
                    LIMIT 50
                    """
                ),
                {"gid": group_id},
            )
            transactions = [dict(r) for r in tx_res.mappings().all()]

            sup_res = await session.execute(
                text(
                    """
                    SELECT
                        t.actor_user_id AS user_id,
                        u.username,
                        u.avatar_url,
                        SUM(t.amount) AS total_tokens
                    FROM scan_treasury_transactions t
                    JOIN users u ON t.actor_user_id = u.id
                    WHERE t.scan_group_id = :gid
                      AND t.type IN ('USER_CONVERSION_DONATION', 'GOAL_CONTRIBUTION')
                      AND t.amount > 0
                    GROUP BY t.actor_user_id, u.username, u.avatar_url
                    ORDER BY total_tokens DESC
                    LIMIT 10
                    """
                ),
                {"gid": group_id},
            )
            top_supporters = [dict(r) for r in sup_res.mappings().all()]

            return {
                "group_id": group_id,
                "vault_tokens": int(group.get("vault_tokens") or 0),
                "total_contributed_tokens": int(
                    group.get("total_contributed_tokens") or 0
                ),
                "clan_level": clan_level,
                "conversion_rate": 50,
                "level_upgrade_cost": 40 * clan_level,
                "announcement_cost": 6,
                "user_balance": user_balance,
                "funding_goals": goals,
                "top_supporters": top_supporters,
                "transactions": transactions,
            }

    async def convert_and_donate(
        self,
        group_id: int,
        user_id: int,
        coins_to_convert: int = 0,
        direct_tokens: int = 0,
        goal_id: Optional[int] = None,
    ) -> dict:
        CONVERSION_RATE = 50
        converted_tokens = 0
        if coins_to_convert > 0:
            if (
                coins_to_convert < CONVERSION_RATE
                or coins_to_convert % CONVERSION_RATE != 0
            ):
                raise ValueError(
                    f"La conversión debe ser en múltiplos de {CONVERSION_RATE} YumeCoins."
                )
            converted_tokens = coins_to_convert // CONVERSION_RATE

        total_tokens_to_donate = converted_tokens + max(
            0, int(direct_tokens or 0)
        )
        if total_tokens_to_donate <= 0:
            raise ValueError(
                "Debes convertir al menos 50 YumeCoins o aportar al menos 1 Cristal de Clan."
            )

        async with resolve_session(self.conn) as session:
            u_res = await session.execute(
                select(UserORM).where(UserORM.id == user_id).with_for_update()
            )
            user_obj = u_res.scalar_one_or_none()
            if not user_obj:
                raise ValueError("Usuario no encontrado.")

            current_coins = int(user_obj.coins or 0)
            current_clan_tokens = int(user_obj.clan_tokens or 0)

            if coins_to_convert > current_coins:
                raise ValueError(
                    f"No tienes suficientes YumeCoins (Tienes {current_coins}, necesitas {coins_to_convert})."
                )
            if direct_tokens > current_clan_tokens:
                raise ValueError(
                    f"No tienes suficientes Cristales de Clan (Tienes {current_clan_tokens}, necesitas {direct_tokens})."
                )

            g_res = await session.execute(
                select(ScanGroupORM)
                .where(ScanGroupORM.id == group_id)
                .with_for_update()
            )
            group_obj = g_res.scalar_one_or_none()
            if not group_obj:
                raise ValueError("Grupo Scan no encontrado.")

            new_user_coins = current_coins - coins_to_convert
            new_user_tokens = current_clan_tokens - max(
                0, int(direct_tokens or 0)
            )
            user_obj.coins = new_user_coins
            user_obj.clan_tokens = new_user_tokens

            if coins_to_convert > 0:
                session.add(
                    UserCoinTransactionORM(
                        user_id=user_id,
                        amount=-coins_to_convert,
                        balance_after=new_user_coins,
                        type="CLAN_TOKEN_CONVERSION",
                        description=f"Conversión de {coins_to_convert} YumeCoins a {converted_tokens} Cristales para {group_obj.name}",
                        reference_id=group_id,
                    )
                )

            new_vault = int(group_obj.vault_tokens or 0) + total_tokens_to_donate
            new_total = (
                int(group_obj.total_contributed_tokens or 0)
                + total_tokens_to_donate
            )
            group_obj.vault_tokens = new_vault
            group_obj.total_contributed_tokens = new_total

            tx_type = "USER_CONVERSION_DONATION"
            tx_desc = (
                f"Aporte de {total_tokens_to_donate} Cristales a la Bóveda del Clan"
            )
            if goal_id:
                goal_res = await session.execute(
                    select(ScanFundingGoalORM)
                    .where(
                        ScanFundingGoalORM.id == goal_id,
                        ScanFundingGoalORM.scan_group_id == group_id,
                    )
                    .with_for_update()
                )
                goal = goal_res.scalar_one_or_none()
                if goal and goal.status == "ACTIVE":
                    new_goal_tokens = (
                        int(goal.current_tokens or 0) + total_tokens_to_donate
                    )
                    new_status = (
                        "COMPLETED"
                        if new_goal_tokens >= int(goal.target_tokens or 1)
                        else "ACTIVE"
                    )
                    goal.current_tokens = new_goal_tokens
                    goal.status = new_status
                    if new_status == "COMPLETED" and goal.completed_at is None:
                        await session.execute(
                            text(
                                "UPDATE scan_funding_goals SET completed_at = NOW() WHERE id = :gid"
                            ),
                            {"gid": goal_id},
                        )
                    tx_type = "GOAL_CONTRIBUTION"
                    tx_desc = f"Aporte de {total_tokens_to_donate} Cristales a la meta: {goal.title}"

            session.add(
                ScanTreasuryTransactionORM(
                    scan_group_id=group_id,
                    actor_user_id=user_id,
                    amount=total_tokens_to_donate,
                    balance_after=new_vault,
                    type=tx_type,
                    description=tx_desc,
                    reference_id=goal_id,
                )
            )
            await session.commit()

        return await self.get_scan_treasury(group_id, user_id)

    async def create_funding_goal(
        self,
        group_id: int,
        title: str,
        description: Optional[str],
        work_id: Optional[int],
        target_tokens: int,
    ) -> dict:
        async with resolve_session(self.conn) as session:
            goal = ScanFundingGoalORM(
                scan_group_id=group_id,
                work_id=work_id,
                title=title.strip(),
                description=(description or "").strip() or None,
                target_tokens=max(5, int(target_tokens or 25)),
            )
            session.add(goal)
            await session.commit()
            await session.refresh(goal)
            return goal.to_dict()

    async def delete_funding_goal(self, group_id: int, goal_id: int) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                delete(ScanFundingGoalORM).where(
                    ScanFundingGoalORM.id == goal_id,
                    ScanFundingGoalORM.scan_group_id == group_id,
                )
            )
            await session.commit()
            return (res.rowcount or 0) > 0

    async def reward_member_from_vault(
        self,
        group_id: int,
        actor_user_id: int,
        target_user_id: int,
        amount_tokens: int,
        reason: Optional[str] = None,
    ) -> dict:
        if amount_tokens <= 0:
            raise ValueError("La cantidad de Cristales debe ser mayor a 0.")
        COINS_PER_TOKEN_REWARD = 40
        async with resolve_session(self.conn) as session:
            g_res = await session.execute(
                select(ScanGroupORM)
                .where(ScanGroupORM.id == group_id)
                .with_for_update()
            )
            group = g_res.scalar_one_or_none()
            if not group:
                raise ValueError("Clan no encontrado.")
            vault = int(group.vault_tokens or 0)
            if amount_tokens > vault:
                raise ValueError(
                    f"La Bóveda del Clan solo tiene {vault} Cristales disponibles."
                )

            m_res = await session.execute(
                select(ScanGroupMemberORM).where(
                    ScanGroupMemberORM.group_id == group_id,
                    ScanGroupMemberORM.user_id == target_user_id,
                )
            )
            if m_res.scalar_one_or_none() is None:
                raise ValueError(
                    "El usuario destinatario no pertenece a este clan."
                )

            u_res = await session.execute(
                select(UserORM)
                .where(UserORM.id == target_user_id)
                .with_for_update()
            )
            member_user = u_res.scalar_one_or_none()
            if not member_user:
                raise ValueError("Usuario no encontrado.")

            new_vault = vault - amount_tokens
            group.vault_tokens = new_vault

            bonus_coins = amount_tokens * COINS_PER_TOKEN_REWARD
            new_member_coins = int(member_user.coins or 0) + bonus_coins
            member_user.coins = new_member_coins

            clean_reason = (reason or "Bono por labor en el Scan").strip()
            session.add(
                UserCoinTransactionORM(
                    user_id=target_user_id,
                    amount=bonus_coins,
                    balance_after=new_member_coins,
                    type="TRANSLATION_REWARD",
                    description=f"Premio del Scan {group.name} ({amount_tokens} Cristales de Bóveda convertidos en +{bonus_coins} YumeCoins): {clean_reason}",
                    reference_id=group_id,
                )
            )
            session.add(
                ScanTreasuryTransactionORM(
                    scan_group_id=group_id,
                    actor_user_id=actor_user_id,
                    target_user_id=target_user_id,
                    amount=-amount_tokens,
                    balance_after=new_vault,
                    type="MEMBER_REWARD_PAYOUT",
                    description=f"Premio a @{member_user.username}: +{bonus_coins} YumeCoins (-{amount_tokens} Cristales de Bóveda) — {clean_reason}",
                )
            )
            await session.commit()

            return {
                "message": f"¡Premio enviado! Se convirtieron {amount_tokens} Cristales de la Bóveda en +{bonus_coins} YumeCoins para @{member_user.username}.",
                "vault_tokens": new_vault,
                "target_email": member_user.email,
            }

    async def upgrade_clan_level(
        self, group_id: int, actor_user_id: int
    ) -> dict:
        async with resolve_session(self.conn) as session:
            g_res = await session.execute(
                select(ScanGroupORM)
                .where(ScanGroupORM.id == group_id)
                .with_for_update()
            )
            group = g_res.scalar_one_or_none()
            if not group:
                raise ValueError("Clan no encontrado.")
            current_level = int(group.clan_level or 1)
            cost = 40 * current_level
            vault = int(group.vault_tokens or 0)
            if vault < cost:
                raise ValueError(
                    f"Se requieren {cost} Cristales en la Bóveda para subir a Nivel {current_level + 1} (Tienes {vault})."
                )

            new_vault = vault - cost
            new_level = current_level + 1
            group.vault_tokens = new_vault
            group.clan_level = new_level

            session.add(
                ScanTreasuryTransactionORM(
                    scan_group_id=group_id,
                    actor_user_id=actor_user_id,
                    amount=-cost,
                    balance_after=new_vault,
                    type="CLAN_LEVEL_UPGRADE",
                    description=f"Mejora del Clan a Nivel {new_level} (-{cost} Cristales)",
                )
            )
            await session.commit()
            return {
                "message": f"¡El Clan ha subido a Nivel {new_level}!",
                "clan_level": new_level,
                "vault_tokens": new_vault,
            }

    async def get_scan_announcements(self, group_id: int) -> List[dict]:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                select(
                    AnnouncementORM.id,
                    AnnouncementORM.scan_group_id,
                    AnnouncementORM.type,
                    AnnouncementORM.type_label,
                    AnnouncementORM.source,
                    AnnouncementORM.title,
                    AnnouncementORM.description,
                    AnnouncementORM.created_at,
                    AnnouncementORM.expires_at,
                    AnnouncementORM.is_active,
                )
                .where(
                    AnnouncementORM.scan_group_id == group_id,
                    AnnouncementORM.is_active.is_(True),
                )
                .order_by(AnnouncementORM.created_at.desc())
                .limit(20)
            )
            return [dict(r) for r in res.mappings().all()]

    async def create_scan_announcement(
        self,
        group_id: int,
        actor_user_id: int,
        title: str,
        description: str,
        type_label: str = "Scans",
        use_vault: bool = False,
    ) -> dict:
        COST = 6 if use_vault else 0
        async with resolve_session(self.conn) as session:
            g_res = await session.execute(
                select(ScanGroupORM)
                .where(ScanGroupORM.id == group_id)
                .with_for_update()
            )
            group = g_res.scalar_one_or_none()
            if not group:
                raise ValueError("Clan no encontrado.")

            vault = int(group.vault_tokens or 0)
            if COST > 0:
                if vault < COST:
                    raise ValueError(
                        f"Se requieren {COST} Cristales en la Bóveda para publicar un anuncio destacado (Tienes {vault})."
                    )
                vault -= COST
                group.vault_tokens = vault
                session.add(
                    ScanTreasuryTransactionORM(
                        scan_group_id=group_id,
                        actor_user_id=actor_user_id,
                        amount=-COST,
                        balance_after=vault,
                        type="ANNOUNCEMENT_PURCHASE",
                        description=f"Anuncio destacado del Clan: {title[:60]}",
                    )
                )

            ann = AnnouncementORM(
                scan_group_id=group_id,
                type="scan",
                type_label=type_label or "Scans",
                source=group.name,
                title=title.strip(),
                description=description.strip(),
                is_active=True,
            )
            session.add(ann)
            await session.commit()
            await session.refresh(ann)
            return ann.to_dict()

    async def delete_scan_announcement(
        self, group_id: int, announcement_id: int
    ) -> bool:
        async with resolve_session(self.conn) as session:
            res = await session.execute(
                delete(AnnouncementORM).where(
                    AnnouncementORM.id == announcement_id,
                    AnnouncementORM.scan_group_id == group_id,
                )
            )
            await session.commit()
            return (res.rowcount or 0) > 0
