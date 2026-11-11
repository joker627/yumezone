from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class StatusORM(Base):
    __tablename__ = "statuses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class FormatORM(Base):
    __tablename__ = "formats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class DemographicORM(Base):
    __tablename__ = "demographics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class GenreORM(Base):
    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class TagORM(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class WorkORM(Base):
    __tablename__ = "works"
    __table_args__ = (
        Index("idx_works_title", "title"),
        Index("idx_works_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    alternative_title: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    synopsis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cover_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    banner_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("statuses.id", ondelete="SET NULL"), nullable=True
    )
    format_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("formats.id", ondelete="SET NULL"), nullable=True
    )
    demographic_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("demographics.id", ondelete="SET NULL"), nullable=True
    )
    scan_group_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("scan_groups.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class WorkGenreORM(Base):
    __tablename__ = "work_genres"

    work_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("works.id", ondelete="CASCADE"), primary_key=True
    )
    genre_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True
    )


class WorkTagORM(Base):
    __tablename__ = "work_tags"

    work_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("works.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )


class WorkStatisticsORM(Base):
    __tablename__ = "work_statistics"
    __table_args__ = (
        Index("idx_stats_trending", "trending_score"),
        Index("idx_stats_weekly", "weekly_views"),
        Index("idx_stats_monthly", "monthly_views"),
        Index("idx_stats_favorites", "favorites_count"),
        Index("idx_ws_last_published", "last_published_at"),
    )

    work_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("works.id", ondelete="CASCADE"), primary_key=True
    )
    total_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    daily_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weekly_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    monthly_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating_average: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("0.00")
    )
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    trending_score: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0.00")
    )
    views_last_24h: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    favorites_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    latest_chapter_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latest_chapter_number: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    first_chapter_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chapters_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

