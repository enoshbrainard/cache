"""Backend tests for the Distributed Cache Simulator (Express via FastAPI proxy)."""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="function", autouse=True)
def _reset_cluster():
    # Reset cluster to a known state before each test.
    r = requests.post(f"{API}/reset", timeout=10)
    assert r.status_code == 200, f"reset failed: {r.status_code} {r.text}"
    yield


# ---------- Health & State ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert data.get("service") == "cache-sim"


def test_state_default_three_nodes_and_ring():
    r = requests.get(f"{API}/state", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "nodes" in data and "ring" in data and "config" in data
    assert len(data["nodes"]) == 3
    # Each node has 40 vnodes -> 120 ring entries
    assert len(data["ring"]) == 3 * 40
    assert data["config"]["policy"] == "LRU"


# ---------- Cache CRUD ----------
def test_set_get_delete_key_flow():
    # SET
    r = requests.post(f"{API}/cache", json={"key": "TEST_k1", "value": "v1"}, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("ok") is True
    assert body.get("primary") in {"node-1", "node-2", "node-3"}
    primary = body["primary"]

    # GET hit
    r = requests.get(f"{API}/cache/TEST_k1", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("hit") is True
    assert body.get("value") == "v1"
    assert body.get("primary") == primary

    # DELETE
    r = requests.delete(f"{API}/cache/TEST_k1", timeout=10)
    assert r.status_code == 200
    assert r.json().get("deleted") is True

    # Subsequent GET miss
    r = requests.get(f"{API}/cache/TEST_k1", timeout=10)
    assert r.status_code == 200
    assert r.json().get("hit") is False


def test_get_nonexistent_is_miss_and_counted():
    # baseline
    m0 = requests.get(f"{API}/metrics", timeout=10).json()["totals"]["misses"]
    r = requests.get(f"{API}/cache/TEST_does_not_exist", timeout=10)
    assert r.status_code == 200
    assert r.json().get("hit") is False
    m1 = requests.get(f"{API}/metrics", timeout=10).json()["totals"]["misses"]
    assert m1 == m0 + 1


# ---------- Lookup ----------
def test_lookup_returns_primary_replicas_angle():
    r = requests.get(f"{API}/lookup/TEST_lookup_key", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("primary") is not None
    assert "replicas" in data
    assert "angle" in data
    assert 0 <= data["angle"] <= 360


# ---------- Config: policy / capacity / replication / latency ----------
def test_config_policy_switch_to_lfu():
    r = requests.post(f"{API}/config", json={"policy": "LFU"}, timeout=10)
    assert r.status_code == 200
    state = requests.get(f"{API}/state", timeout=10).json()
    assert state["config"]["policy"] == "LFU"


def test_lru_eviction_when_capacity_reduced():
    requests.post(f"{API}/config", json={"policy": "LRU"}, timeout=10)
    # Force everything to one node so capacity overflow is deterministic.
    requests.post(f"{API}/config", json={"capacityPerNode": 100}, timeout=10)
    state = requests.get(f"{API}/state", timeout=10).json()
    nodes = [n["id"] for n in state["nodes"]]
    # Remove all but one node so all keys land on the remaining one
    for nid in nodes[1:]:
        requests.delete(f"{API}/nodes/{nid}", timeout=10)

    # SET 5 keys
    keys = [f"TEST_lru_{i}" for i in range(5)]
    for k in keys:
        requests.post(f"{API}/cache", json={"key": k, "value": k}, timeout=10)

    # Touch newer keys so older ones become LRU candidates
    requests.get(f"{API}/cache/{keys[2]}", timeout=10)
    requests.get(f"{API}/cache/{keys[3]}", timeout=10)
    requests.get(f"{API}/cache/{keys[4]}", timeout=10)

    # Reduce capacity -> evictions should occur on overflow
    r = requests.post(f"{API}/config", json={"capacityPerNode": 3}, timeout=10)
    assert r.status_code == 200

    # Insert one more new key on same node, oldest LRU should be evicted
    state = requests.get(f"{API}/state", timeout=10).json()
    sole = state["nodes"][0]
    assert sole["size"] <= 3
    assert sole["metrics"]["evictions"] >= 1


def test_replication_factor_two_populates_two_nodes():
    r = requests.post(f"{API}/config", json={"replicationFactor": 2}, timeout=10)
    assert r.status_code == 200
    requests.post(f"{API}/cache", json={"key": "TEST_rep1", "value": "x"}, timeout=10)
    look = requests.get(f"{API}/lookup/TEST_rep1", timeout=10).json()
    assert look.get("primary") is not None
    assert isinstance(look.get("replicas"), list) and len(look["replicas"]) >= 1

    state = requests.get(f"{API}/state", timeout=10).json()
    nodes_with_key = [
        n["id"] for n in state["nodes"] if any(k["key"] == "TEST_rep1" for k in n["keys"])
    ]
    assert len(nodes_with_key) >= 2


def test_artificial_latency_applied():
    r = requests.post(f"{API}/config", json={"artificialLatencyMs": 200}, timeout=10)
    assert r.status_code == 200
    t0 = time.time()
    requests.post(f"{API}/cache", json={"key": "TEST_lat", "value": "v"}, timeout=10)
    elapsed = time.time() - t0
    assert elapsed >= 0.18, f"latency not applied: {elapsed}"
    # cleanup latency
    requests.post(f"{API}/config", json={"artificialLatencyMs": 0}, timeout=10)


# ---------- Topology ----------
def test_add_and_remove_node_with_migration():
    before = requests.get(f"{API}/state", timeout=10).json()
    initial_count = len(before["nodes"])

    # Seed a few keys
    for i in range(8):
        requests.post(
            f"{API}/cache", json={"key": f"TEST_topo_{i}", "value": str(i)}, timeout=10
        )

    add = requests.post(f"{API}/nodes", timeout=10)
    assert add.status_code == 200
    after_add = requests.get(f"{API}/state", timeout=10).json()
    assert len(after_add["nodes"]) == initial_count + 1

    # Verify keys still readable
    for i in range(8):
        r = requests.get(f"{API}/cache/TEST_topo_{i}", timeout=10)
        assert r.json().get("hit") is True

    # Remove the newly added node
    new_node_id = add.json().get("nodeId")
    rem = requests.delete(f"{API}/nodes/{new_node_id}", timeout=10)
    assert rem.status_code == 200

    # Keys still readable after migration
    for i in range(8):
        r = requests.get(f"{API}/cache/TEST_topo_{i}", timeout=10)
        assert r.json().get("hit") is True, f"lost key TEST_topo_{i} after node removal"


# ---------- TTL ----------
def test_ttl_expires():
    requests.post(f"{API}/cache", json={"key": "TEST_ttl", "value": "v", "ttlMs": 800}, timeout=10)
    r1 = requests.get(f"{API}/cache/TEST_ttl", timeout=10).json()
    assert r1.get("hit") is True
    time.sleep(1.2)
    r2 = requests.get(f"{API}/cache/TEST_ttl", timeout=10).json()
    assert r2.get("hit") is False
    assert r2.get("expired") is True


# ---------- Metrics & Logs ----------
def test_metrics_shape_and_per_node():
    requests.post(f"{API}/cache", json={"key": "TEST_m1", "value": "v"}, timeout=10)
    requests.get(f"{API}/cache/TEST_m1", timeout=10)
    requests.get(f"{API}/cache/TEST_missing", timeout=10)
    m = requests.get(f"{API}/metrics", timeout=10).json()
    assert "totals" in m and "perNode" in m
    for k in ("hits", "misses", "requests", "hitRate"):
        assert k in m["totals"]
    assert m["totals"]["hits"] >= 1
    assert m["totals"]["misses"] >= 1
    assert len(m["perNode"]) == 3


def test_logs_and_clear():
    requests.post(f"{API}/cache", json={"key": "TEST_log", "value": "v"}, timeout=10)
    requests.get(f"{API}/cache/TEST_log", timeout=10)
    body = requests.get(f"{API}/logs", timeout=10).json()
    logs = body.get("logs", body) if isinstance(body, dict) else body
    assert isinstance(logs, list)
    events = {e.get("event") for e in logs}
    assert "SET" in events
    assert "HIT" in events
    # Clear
    r = requests.delete(f"{API}/logs", timeout=10)
    assert r.status_code == 200
    after_body = requests.get(f"{API}/logs", timeout=10).json()
    after = after_body.get("logs", after_body) if isinstance(after_body, dict) else after_body
    # After clear, only freshly-recorded events from this GET request might exist
    assert len(after) <= 2


def test_reset_returns_three_nodes_and_lru():
    requests.post(f"{API}/config", json={"policy": "LFU"}, timeout=10)
    requests.post(f"{API}/nodes", timeout=10)
    r = requests.post(f"{API}/reset", timeout=10)
    assert r.status_code == 200
    state = requests.get(f"{API}/state", timeout=10).json()
    assert len(state["nodes"]) == 3
    assert state["config"]["policy"] == "LRU"
