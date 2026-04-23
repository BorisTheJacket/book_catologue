from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import Optional
from database import get_db
from models import Novel, Chapter
from routes.auth import verify_telegram_init_data, ADMIN_TELEGRAM_IDS
import os
import uuid
from PIL import Image
import io

router = APIRouter(prefix="/novels", tags=["novels"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./static/covers")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _admin_authorized(x_admin_secret: Optional[str], x_telegram_init: Optional[str]) -> bool:
    """ADMIN_SECRET, or valid Telegram Mini App initData for a user listed in ADMIN_TELEGRAM_ID."""
    configured = os.getenv("ADMIN_SECRET", "change-me")
    if (x_admin_secret or "").strip() and (x_admin_secret or "").strip() == configured:
        return True
    if x_telegram_init:
        user = verify_telegram_init_data(x_telegram_init)
        if user and str(user.get("id")) in ADMIN_TELEGRAM_IDS:
            return True
    return False


def _admin_or_403(x_admin_secret: Optional[str], x_telegram_init: Optional[str]) -> None:
    if not _admin_authorized(x_admin_secret, x_telegram_init):
        raise HTTPException(status_code=403, detail="Admin access required (ADMIN_SECRET or Telegram owner)")


# ── Helpers ──────────────────────────────────────────────────────────────────

async def save_cover_image(file: UploadFile) -> str:
    """Save uploaded cover image, resize to 400x600, return relative path."""
    ext = file.filename.split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(status_code=400, detail="Only jpg/png/webp allowed")

    content = await file.read()
    img = Image.open(io.BytesIO(content)).convert("RGB")
    img = img.resize((400, 600), Image.LANCZOS)

    filename = f"{uuid.uuid4()}.jpg"
    path = os.path.join(UPLOAD_DIR, filename)
    img.save(path, "JPEG", quality=90)
    return f"/static/covers/{filename}"


def novel_to_dict(novel: Novel, include_chapters: bool = False) -> dict:
    chapters = novel.chapters if novel.chapters is not None else []
    data = {
        "id": novel.id,
        "title": novel.title,
        "author": novel.author,
        "description": novel.description,
        "cover_image": novel.cover_image,
        "is_published": novel.is_published,
        "created_at": novel.created_at.isoformat(),
        "chapter_count": len(chapters),
    }
    if include_chapters:
        data["chapters"] = [
            {"id": c.id, "title": c.title, "content": c.content, "order": c.order}
            for c in sorted(chapters, key=lambda c: (c.order, c.id))
        ]
    return data


# ── Public Endpoints (require whitelist via frontend check) ───────────────────

@router.get("/")
async def list_novels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Novel)
        .options(selectinload(Novel.chapters))
        .where(Novel.is_published == True)
        .order_by(Novel.created_at.desc())
    )
    novels = result.scalars().unique().all()
    return [novel_to_dict(n) for n in novels]


@router.get("/admin/catalog")
async def admin_list_novels(
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
    db: AsyncSession = Depends(get_db),
):
    """All novels (including drafts) for the admin UI."""
    _admin_or_403(x_admin_secret, x_telegram_init_data)
    result = await db.execute(
        select(Novel)
        .options(selectinload(Novel.chapters))
        .order_by(Novel.created_at.desc())
    )
    novels = result.scalars().unique().all()
    return [novel_to_dict(n) for n in novels]


@router.get("/{novel_id}")
async def get_novel(novel_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Novel)
        .options(selectinload(Novel.chapters))
        .where(Novel.id == novel_id)
    )
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    return novel_to_dict(novel, include_chapters=True)


# ── Admin Endpoints ────────────────────────────────────────────────────────────

@router.post("/admin/novels")
async def create_novel(
    title: str = Form(...),
    author: str = Form(...),
    description: str = Form(""),
    x_admin_secret: str = Form(""),
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
    cover: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    _admin_or_403(x_admin_secret or None, x_telegram_init_data)

    cover_path = None
    if cover and cover.filename:
        cover_path = await save_cover_image(cover)

    novel = Novel(title=title, author=author, description=description, cover_image=cover_path)
    db.add(novel)
    await db.commit()
    await db.refresh(novel)
    return novel_to_dict(novel)


@router.put("/admin/novels/{novel_id}")
async def update_novel(
    novel_id: int,
    title: Optional[str] = Form(default=None),
    author: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    is_published: Optional[str] = Form(default=None),
    x_admin_secret: str = Form(""),
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
    cover: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    _admin_or_403(x_admin_secret or None, x_telegram_init_data)

    result = await db.execute(
        select(Novel).options(selectinload(Novel.chapters)).where(Novel.id == novel_id)
    )
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    if title is not None:
        novel.title = title
    if author is not None:
        novel.author = author
    if description is not None:
        novel.description = description
    if is_published is not None and str(is_published).strip() != "":
        novel.is_published = str(is_published).lower() in ("1", "true", "yes", "on")

    if cover and cover.filename:
        novel.cover_image = await save_cover_image(cover)

    await db.commit()
    await db.refresh(novel)
    return novel_to_dict(novel, include_chapters=True)


@router.delete("/admin/novels/{novel_id}")
async def delete_novel(
    novel_id: int,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
    db: AsyncSession = Depends(get_db),
):
    _admin_or_403(x_admin_secret, x_telegram_init_data)

    result = await db.execute(select(Novel).where(Novel.id == novel_id))
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    await db.execute(delete(Chapter).where(Chapter.novel_id == novel_id))
    await db.execute(delete(Novel).where(Novel.id == novel_id))
    await db.commit()
    return {"deleted": novel_id}


@router.post("/admin/novels/{novel_id}/chapters")
async def add_chapter(
    novel_id: int,
    title: str = Form(...),
    content: str = Form(...),
    order: int = Form(0),
    x_admin_secret: str = Form(""),
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
    db: AsyncSession = Depends(get_db),
):
    _admin_or_403(x_admin_secret or None, x_telegram_init_data)

    chapter = Chapter(novel_id=novel_id, title=title, content=content, order=order)
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return {"id": chapter.id, "title": chapter.title, "content": chapter.content, "order": chapter.order}


@router.put("/admin/chapters/{chapter_id}")
async def update_chapter(
    chapter_id: int,
    title: Optional[str] = Form(default=None),
    content: Optional[str] = Form(default=None),
    order: Optional[int] = Form(default=None),
    x_admin_secret: str = Form(""),
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
    db: AsyncSession = Depends(get_db),
):
    _admin_or_403(x_admin_secret or None, x_telegram_init_data)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if title is not None:
        chapter.title = title
    if content is not None:
        chapter.content = content
    if order is not None:
        chapter.order = order

    await db.commit()
    await db.refresh(chapter)
    return {"id": chapter.id, "title": chapter.title, "content": chapter.content, "order": chapter.order}


@router.delete("/admin/chapters/{chapter_id}")
async def delete_chapter(
    chapter_id: int,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
    db: AsyncSession = Depends(get_db),
):
    _admin_or_403(x_admin_secret, x_telegram_init_data)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    await db.execute(delete(Chapter).where(Chapter.id == chapter_id))
    await db.commit()
    return {"deleted": chapter_id}
