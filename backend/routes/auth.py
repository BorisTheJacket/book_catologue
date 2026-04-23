from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import WhitelistedUser
import hashlib
import hmac
import os
import json
from urllib.parse import unquote

router = APIRouter(prefix="/auth", tags=["auth"])

BOT_TOKEN = os.getenv("BOT_TOKEN", "")


def verify_telegram_init_data(init_data: str) -> dict | None:
    """
    Verify the initData string sent by Telegram Mini App.
    Returns parsed user dict if valid, None if invalid.
    """
    try:
        parsed = {}
        pairs = [pair.split("=", 1) for pair in init_data.split("&")]
        data_check_string_parts = []
        received_hash = ""

        for key, value in pairs:
            if key == "hash":
                received_hash = value
            else:
                data_check_string_parts.append(f"{key}={unquote(value)}")

        data_check_string_parts.sort()
        data_check_string = "\n".join(data_check_string_parts)

        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_hash, received_hash):
            return None

        # Extract user from parsed data
        for key, value in pairs:
            if key == "user":
                return json.loads(unquote(value))

        return None
    except Exception:
        return None


@router.post("/verify")
async def verify_user(
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Frontend calls this with Telegram's initData.
    Returns access status.
    """
    init_data = payload.get("initData", "")

    # In development you can skip verification
    if os.getenv("DEV_MODE") == "true":
        telegram_id = str(payload.get("telegram_id", "dev_user"))
    else:
        user_data = verify_telegram_init_data(init_data)
        if not user_data:
            raise HTTPException(status_code=401, detail="Invalid Telegram data")
        telegram_id = str(user_data["id"])

    # Check whitelist
    result = await db.execute(
        select(WhitelistedUser).where(
            WhitelistedUser.telegram_id == telegram_id,
            WhitelistedUser.is_active == True
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=403, detail="Access denied. You need an invite link.")

    return {"access": True, "telegram_id": telegram_id}
