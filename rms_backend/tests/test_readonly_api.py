from unittest.mock import MagicMock

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes import readonly_routes as api


def make_client(monkeypatch):
    monkeypatch.setattr(api.settings, "readonly_api_key", "test-secret")
    monkeypatch.setattr(api.settings, "readonly_tenant_id", "tenant-a")
    monkeypatch.setattr(api.settings, "readonly_mongodb_uri", "mongodb://unused")
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app)


def test_authentication_and_disabled_configuration(monkeypatch):
    client = make_client(monkeypatch)
    assert client.get("/api/readonly/v1/resources").status_code == 401
    assert client.get("/api/readonly/v1/resources", headers={"X-API-Key": "wrong"}).status_code == 401
    monkeypatch.setattr(api.settings, "readonly_mongodb_uri", None)
    assert client.get("/api/readonly/v1/resources", headers={"X-API-Key": "test-secret"}).status_code == 503


def test_reads_are_scoped_projected_and_paginated(monkeypatch):
    client = make_client(monkeypatch)
    ids = [ObjectId(), ObjectId()]
    collection = MagicMock()
    cursor = collection.find.return_value
    cursor.sort.return_value = cursor
    cursor.limit.return_value = cursor
    cursor.max_time_ms.return_value = cursor

    async def to_list(length):
        return [{"_id": oid, "product_name": "Widget"} for oid in ids]

    cursor.to_list = to_list
    monkeypatch.setattr(api, "read_database", lambda: {"products": collection})
    response = client.get("/api/readonly/v1/products?limit=1&q=a.*", headers={"X-API-Key": "test-secret"})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["next_cursor"] == str(ids[0])
    assert len(response.json()["items"]) == 1
    query, projection = collection.find.call_args.args
    assert query["tenant_id"] == "tenant-a"
    assert query["$or"][0]["barcode"]["$regex"] == r"a\.\*"
    assert "password" not in projection
    assert all(value == 1 for value in projection.values())


def test_record_lookup_cannot_cross_tenants(monkeypatch):
    client = make_client(monkeypatch)
    collection = MagicMock()
    oid = ObjectId()

    async def find_one(query, projection, **kwargs):
        assert query == {"tenant_id": "tenant-a", "_id": oid}
        return None

    collection.find_one = find_one
    monkeypatch.setattr(api, "read_database", lambda: {"products": collection})
    assert client.get(f"/api/readonly/v1/products/{oid}", headers={"X-API-Key": "test-secret"}).status_code == 404


def test_methods_resources_and_inputs_are_restricted(monkeypatch):
    client = make_client(monkeypatch)
    headers = {"X-API-Key": "test-secret"}
    for method in ("post", "put", "patch", "delete"):
        assert getattr(client, method)("/api/readonly/v1/products", headers=headers).status_code == 405
    for path in ("admins", "active_sessions", "tenants"):
        assert client.get(f"/api/readonly/v1/{path}", headers=headers).status_code == 404
    assert client.get("/api/readonly/v1/products?limit=201", headers=headers).status_code == 422

