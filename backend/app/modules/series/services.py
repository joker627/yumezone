# imports standard
from typing import Any, Optional
from fastapi import HTTPException

# imports internal
from app.core.redis import cached_query
from app.modules.series.schemas import Work
from app.modules.series.repository import WorkRepository
from app.modules.series.schemas import WorkCreate
from app.utils.formatters import generate_slug


class WorkService:
    def __init__(self, repository: WorkRepository):
        self.repository = repository

    # get all works with pagination
    async def get_all_works(
        self,
        page: int = 1,
        per_page: int = 25,
        query: str | None = None,
        *,
        format_id: list[int] | None = None,
        status_id: list[int] | None = None,
        demographic_id: list[int] | None = None,
        genre_id: list[int] | None = None,
        sort: str = "relevance",
    ) -> dict:
        (
            works,
            total,
            current_page,
            last_visible_page,
        ) = await self.repository.get_all_works(
            page,
            per_page,
            query,
            format_id=format_id,
            status_id=status_id,
            demographic_id=demographic_id,
            genre_id=genre_id,
            sort=sort,
        )

        has_previous_page = current_page > 1
        has_next_page = current_page < last_visible_page

        return {
            "pagination": {
                "last_visible_page": last_visible_page,
                "has_previous_page": has_previous_page,
                "has_next_page": has_next_page,
                "previous_page": current_page - 1 if has_previous_page else None,
                "next_page": current_page + 1 if has_next_page else None,
                "current_page": current_page,
                "items": {
                    "count": len(works),
                    "total": total,
                    "per_page": per_page,
                },
            },
            "data": works,
        }

    # obtener filtros con cache redis de 5m
    async def get_filters(self) -> dict:
        return await cached_query(
            "yume:cache:works:filters",
            lambda: self.repository.get_filters(),
            ttl=300,
        )

    # get work by slug
    async def get_work_by_slug(self, slug: str) -> Work:
        work = await self.repository.get_work_by_slug(slug)
        if not work:
            raise HTTPException(
                status_code=404,
                detail="Obra no encontrada",
            )
        return work

    # get work detail (consolidado)
    async def get_work_detail(
        self, slug_or_id: str, user_id: Optional[int] = None
    ) -> dict[str, Any]:
        data = await self.repository.get_work_detail_data(slug_or_id, user_id=user_id)
        if not data:
            raise HTTPException(
                status_code=404,
                detail="Obra no encontrada",
            )
        return data

    # create a new work
    async def create_work(self, work_data: WorkCreate) -> Work:
        slug = generate_slug(work_data.title)
        existing_work = await self.repository.get_work_by_slug(slug)
        if existing_work:
            raise HTTPException(
                status_code=400,
                detail="Ya existe una obra con este título",
            )
        new_work = Work(
            title=work_data.title,
            slug=slug,
            alternative_title=work_data.alternative_title,
            synopsis=work_data.synopsis,
            author=work_data.author,
            cover_url=work_data.cover_url,
            banner_url=work_data.banner_url,
            status_id=work_data.status_id,
            format_id=work_data.format_id,
            demographic_id=work_data.demographic_id,
            scan_group_id=work_data.scan_group_id,
        )
        created = await self.repository.create_work(new_work)
        if work_data.genre_ids is not None and created.id:
            await self.repository.set_work_genres(created.id, work_data.genre_ids)
        return created

    # get work by id
    async def get_work_by_id(self, work_id: int) -> Work:
        work = await self.repository.get_work_by_id(work_id)
        if not work:
            raise HTTPException(
                status_code=404,
                detail="Obra no encontrada",
            )
        return work

    # update work
    async def update_work(self, work_id: int, work_data: dict) -> Work:
        work = await self.get_work_by_id(work_id)

        # update fields
        for key, value in work_data.items():
            if hasattr(work, key) and value is not None:
                setattr(work, key, value)

        # Handle title -> slug logic if title changed
        if "title" in work_data and work_data["title"]:
            new_slug = generate_slug(work_data["title"])
            if new_slug != work.slug:
                existing_work = await self.repository.get_work_by_slug(new_slug)
                if existing_work and existing_work.id != work_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Ya existe una obra con este título",
                    )
                work.slug = new_slug

        updated = await self.repository.update_work(work)
        if "genre_ids" in work_data and work_data["genre_ids"] is not None:
            await self.repository.set_work_genres(work_id, work_data["genre_ids"])
        return updated

    # delete work
    async def delete_work(self, work_id: int) -> bool:
        # Validamos existencia (lanza 404 si no existe)
        await self.get_work_by_id(work_id)
        return await self.repository.delete_work(work_id)

    # sugerencias rapidas para buscador (obras y usuarios)
    async def get_search_suggestions(self, q: str, limit: int = 7) -> list[dict]:
        return await self.repository.get_search_suggestions(q, limit=limit)