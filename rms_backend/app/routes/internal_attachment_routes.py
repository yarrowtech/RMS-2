"""
internal_attachment_routes.py
==============================
RMS Communication Centre — file/image/PDF sharing for chat and document
comments. Not a new upload mechanism: this reuses the same Cloudinary
config and upload call already proven in design_pattern_routes.py's
`/api/design-pattern/assets` (used by AssetUploader.jsx), just without the
Design & Pattern department gate, since chat and comments are used by
every department.

Additive only: one new endpoint, no new collections (the returned URL is
stored inline on the chat message / comment document that references it).
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Any, Dict
import cloudinary
import cloudinary.uploader

from ..config import settings
from .deps import get_any_tenant

router = APIRouter(prefix="/api/internal-notifications", tags=["Internal Notifications"])

TenantCtx = Dict[str, Any]

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret, secure=True,
)

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_FILES_PER_REQUEST = 6


@router.post("/attachments")
async def upload_attachments(files: list[UploadFile] = File(...), ctx: TenantCtx = Depends(get_any_tenant)):
    """Any tenant admin may attach files to a chat message or document
    comment — there's no department gate here, unlike the Design & Pattern
    asset uploader this mirrors."""
    if not files or len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"Upload between 1 and {MAX_FILES_PER_REQUEST} files at a time.")
    rows = []
    for file in files:
        raw = await file.read()
        if not raw:
            continue
        if len(raw) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"{file.filename} exceeds {MAX_FILE_BYTES // (1024 * 1024)} MB.")
        try:
            result = cloudinary.uploader.upload(
                raw, folder=f"rms/internal-chat/{ctx['tenant_id']}", resource_type="auto",
                use_filename=True, unique_filename=True,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Could not upload {file.filename}: {exc}")
        rows.append({
            "name": (file.filename or "file")[:240],
            "url": result.get("secure_url") or result.get("url"),
            "resource_type": result.get("resource_type"),
            "format": result.get("format"),
            "bytes": len(raw),
        })
    return {"message": f"{len(rows)} file(s) uploaded.", "data": rows}
