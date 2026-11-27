import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from app.routes.hq_store_routes import hq_set_pos_terminal_role


def test_hq_role_update_is_scoped_to_tenant_and_store():
    terminals = SimpleNamespace(update_one=AsyncMock(return_value=SimpleNamespace(matched_count=1)))
    audit = SimpleNamespace(insert_one=AsyncMock())
    ctx = {"tenant_id": "tenant-a", "admin_name": "Manager"}
    with patch("app.routes.hq_store_routes.db", {"pos_terminals": terminals, "cashier_pos_audit_logs": audit}):
        result = asyncio.run(hq_set_pos_terminal_role("store-a", "terminal-a", {"role": "supervisor"}, ctx))
    assert result["role"] == "supervisor"
    assert terminals.update_one.call_args.args[0] == {"tenant_id": "tenant-a", "store_id": "store-a", "terminal_id": "terminal-a"}
    assert audit.insert_one.call_args.args[0]["details"]["role"] == "supervisor"


def test_hq_role_update_rejects_invalid_role():
    try:
        asyncio.run(hq_set_pos_terminal_role("store-a", "terminal-a", {"role": "owner"}, {"tenant_id": "tenant-a"}))
    except HTTPException as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("Invalid terminal role was accepted")
