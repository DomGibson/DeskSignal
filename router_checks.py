"""Serve the router diagnostic page and run one locally requested probe."""
import ipaddress
import json
import re
import socket
import subprocess
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

HOST = "127.0.0.1"
PORT = 8766
ORIGIN = f"http://{HOST}:{PORT}"
ROOT = Path(__file__).resolve().parent
ASSETS = {
    "/": ("router.html", "text/html; charset=utf-8"),
    "/router.html": ("router.html", "text/html; charset=utf-8"),
    "/router.mjs": ("router.mjs", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
}


def ping(ip):
    if sys.platform == "win32":
        command = ["ping", "-4", "-n", "1", "-w", "2000", ip]
    elif sys.platform == "darwin":
        command = ["ping", "-n", "-c", "1", "-W", "2000", ip]
    else:
        command = ["ping", "-n", "-c", "1", "-W", "2", ip]
    try:
        result = subprocess.run(command, capture_output=True, timeout=3, check=False)
    except subprocess.TimeoutExpired:
        return "No echo reply within the timeout. ICMP may be filtered."
    except OSError:
        return "System ping is unavailable."
    if re.search(rb"\bttl\s*=", result.stdout, re.IGNORECASE):
        return "Echo reply received."
    if result.returncode and not result.stdout:
        return "System ping could not complete."
    return "No echo reply received. ICMP may be filtered."


def check_tcp(ip, port):
    if port is None:
        return "Skipped. Enter a port to check it."
    try:
        with socket.create_connection((ip, port), timeout=2):
            return f"Port {port}: connection accepted."
    except ConnectionRefusedError:
        return f"Port {port}: connection refused."
    except TimeoutError:
        return f"Port {port}: timed out."
    except OSError as error:
        return f"Port {port}: connection failed (OS error {error.errno})."


class Handler(BaseHTTPRequestHandler):
    def send_data(self, status, payload, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        asset = ASSETS.get(urlsplit(self.path).path)
        if self.headers.get("Host") != f"{HOST}:{PORT}" or not asset:
            self.send_error(404)
            return
        name, content_type = asset
        try:
            payload = (ROOT / name).read_bytes()
        except OSError:
            self.send_error(404)
            return
        self.send_data(200, payload, content_type)

    def do_POST(self):
        if self.path != "/api/check" or self.headers.get("Host") != f"{HOST}:{PORT}":
            self.send_error(404)
            return
        if self.headers.get("Origin") != ORIGIN or self.headers.get_content_type() != "application/json":
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 256:
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            ip = str(ipaddress.IPv4Address(data["ip"]))
            port = data["port"]
            if port is not None and (type(port) is not int or not 1 <= port <= 65535):
                raise ValueError()
        except (ValueError, KeyError, TypeError, UnicodeError):
            self.send_error(400)
            return
        result = {"ping": ping(ip), "tcp": check_tcp(ip, port)}
        self.send_data(200, json.dumps(result).encode(), "application/json")


if __name__ == "__main__":
    with ThreadingHTTPServer((HOST, PORT), Handler) as server:
        print(f"Router Reachability: {ORIGIN}/", flush=True)
        if "--no-browser" not in sys.argv:
            webbrowser.open(f"{ORIGIN}/")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
