from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from database import get_db
from models import Novel, Chapter
import aiofiles
import os
import uuid
from PIL import Image
import io

router = APIRouter(prefix="/novels", tags=["novels"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./static/covers")
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    data = {
        "id": novel.id,
        "title": novel.title,
        "author": novel.author,
        "description": novel.description,
        "cover_image": novel.cover_image,
        "is_published": novel.is_published,
        "created_at": novel.created_at.isoformat(),
        "chapter_count": len(novel.chapters),
    }
    if include_chapters:
        data["chapters"] = [
            {"id": c.id, "title": c.title, "content": c.content, "order": c.order}
            for c in novel.chapters
        ]
    return data


# ── Public Endpoints (require whitelist via frontend check) ───────────────────

@router.get("/")
async def list_novels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Novel).where(Novel.is_published == True).order_by(Novel.created_at.desc())
    )
    novels = result.scalars().all()
    return [novel_to_dict(n) for n in novels]


@router.get("/{novel_id}")
async def get_novel(novel_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Novel).where(Novel.id == novel_id))
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    return novel_to_dict(novel, include_chapters=True)


# ── Admin Endpoints ────────────────────────────────────────────────────────────
# Protected by ADMIN_SECRET header

def require_admin(x_admin_secret: str = None):
    from fastapi import Header
    async def _check(x_admin_secret: Optional[str] = Header(default=None)):
        secret = os.getenv("ADMIN_SECRET", "change-me")
        if x_admin_secret != secret:
            raise HTTPException(status_code=403, detail="Admin access required")
    return _check


@router.post("/admin/novels")
async def create_novel(
    title: str = Form(...),
    author: str = Form(...),
    description: str = Form(""),
    x_admin_secret: str = Form(...),
    cover: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    if x_admin_secret != os.getenv("ADMIN_SECRET", "change-me"):
        raise HTTPException(status_code=403, detail="Admin access required")

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
    title: str = Form(None),
    author: str = Form(None),
    description: str = Form(None),
    is_published: bool = Form(None),
    x_admin_secret: str = Form(...),
    cover: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    if x_admin_secret != os.getenv("ADMIN_SECRET", "change-me"):
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(Novel).where(Novel.id == novel_id))
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    if title is not None:
        novel.title = title
    if author is not None:
        novel.author = author
    if description is not None:
        novel.description = description
    if is_published is not None:
        novel.is_published = is_published
    if cover and cover.filename:
        novel.cover_image = await save_cover_image(cover)

    await db.commit()
    await db.refresh(novel)
    return novel_to_dict(novel, include_chapters=True)


@router.delete("/admin/novels/{novel_id}")
async def delete_novel(
    novel_id: int,
    x_admin_secret: str,
    db: AsyncSession = Depends(get_db),
):
    if x_admin_secret != os.getenv("ADMIN_SECRET", "change-me"):
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(Novel).where(Novel.id == novel_id))
    novel = result.scalar_one_or_none()
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    await db.delete(novel)
    await db.commit()
    return {"deleted": novel_id}


# ── Chapter Management ─────────────────────────────────────────────────────────

@router.post("/admin/novels/{novel_id}/chapters")
async def add_chapter(
    novel_id: int,
    title: str = Form(...),
    content: str = Form(...),
    order: int = Form(0),
    x_admin_secret: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    if x_admin_secret != os.getenv("ADMIN_SECRET", "change-me"):
        raise HTTPException(status_code=403, detail="Admin access required")

    chapter = Chapter(novel_id=novel_id, title=title, content=content, order=order)
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return {"id": chapter.id, "title": chapter.title, "order": chapter.order}


@router.put("/admin/chapters/{chapter_id}")
async def update_chapter(
    chapter_id: int,
    title: str = Form(None),
    content: str = Form(None),
    order: int = Form(None),
    x_admin_secret: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    if x_admin_secret != os.getenv("ADMIN_SECRET", "change-me"):
        raise HTTPException(status_code=403, detail="Admin access required")

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
    return {"id": chapter.id, "title": chapter.title}


@router.delete("/admin/chapters/{chapter_id}")
async def delete_chapter(
    chapter_id: int,
    x_admin_secret: str,
    db: AsyncSession = Depends(get_db),
):
    if x_admin_secret != os.getenv("ADMIN_SECRET", "change-me"):
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    await db.delete(chapter)
    await db.commit()
    return {"deleted": chapter_id}
