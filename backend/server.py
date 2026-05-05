"""
Thin FastAPI proxy. Supervisor pins the backend command to
`uvicorn server:app` on port 8001 (read-only config), but the user requested
a strictly Node.js + Express backend. We satisfy both:

  - This module spawns the real Node.js Express server as a child process on
    127.0.0.1:8002 at startup.
  - All `/api/*` traffic is forwarded verbatim to the Node service.
"""

import asyncio
import logging
import os
import signal
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
NODE_DIR = ROOT_DIR / "node-cache"
NODE_PORT = int(os.environ.get("NODE_CACHE_PORT", "8002"))
NODE_BASE_URL = f"http://127.0.0.1:{NODE_PORT}"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("proxy")

_node_proc: subprocess.Popen | None = None
_http_client: httpx.AsyncClient | None = None


async def _wait_node_ready(timeout: float = 20.0) -> bool:
    deadline = asyncio.get_event_loop().time() + timeout
    async with httpx.AsyncClient(timeout=2.0) as c:
        while asyncio.get_event_loop().time() < deadline:
            try:
                r = await c.get(f"{NODE_BASE_URL}/api/health")
                if r.status_code == 200:
                    return True
            except Exception:
                pass
            await asyncio.sleep(0.3)
    return False


def _spawn_node() -> subprocess.Popen:
    env = os.environ.copy()
    env["NODE_CACHE_PORT"] = str(NODE_PORT)
    logger.info("spawning node cache server in %s on port %d", NODE_DIR, NODE_PORT)
    return subprocess.Popen(
        ["node", "server.js"],
        cwd=str(NODE_DIR),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _node_proc, _http_client
    _node_proc = _spawn_node()
    ok = await _wait_node_ready()
    if not ok:
        logger.error("node cache server failed to start in time")
    else:
        logger.info("node cache server ready at %s", NODE_BASE_URL)
    _http_client = httpx.AsyncClient(base_url=NODE_BASE_URL, timeout=15.0)
    try:
        yield
    finally:
        if _http_client is not None:
            await _http_client.aclose()
        if _node_proc is not None and _node_proc.poll() is None:
            try:
                os.killpg(os.getpgid(_node_proc.pid), signal.SIGTERM)
                _node_proc.wait(timeout=5)
            except Exception:
                try:
                    os.killpg(os.getpgid(_node_proc.pid), signal.SIGKILL)
                except Exception:
                    pass


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
)
async def proxy(path: str, request: Request) -> Response:
    if _http_client is None:
        return Response(status_code=503, content="proxy not ready")
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    try:
        upstream = await _http_client.request(
            method=request.method,
            url=f"/api/{path}",
            headers=headers,
            params=request.query_params,
            content=body,
        )
    except httpx.RequestError as exc:
        logger.error("upstream error: %s", exc)
        return Response(status_code=502, content=f"upstream error: {exc}")
    excluded = {"content-encoding", "transfer-encoding", "connection", "content-length"}
    out_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in excluded}
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=out_headers,
        media_type=upstream.headers.get("content-type"),
    )


@app.get("/")
async def root():
    return {"service": "distributed-cache-simulator", "upstream": NODE_BASE_URL}
