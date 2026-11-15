import base64
import os
import socket
import sys
import threading
import uvicorn
import webview
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from server.main import configure_cors, register_pdf_routes


def get_base_dir() -> str:
    """Get the base path, accounting for PyInstaller bundled sys._MEIPASS."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def find_free_port() -> int:
    """Find an available ephemeral port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


api_app = FastAPI(title="Web PDF Studio Local Server")
configure_cors(api_app)
register_pdf_routes(api_app, engine_label="pdf2docx + PyMuPDF (Embedded)")

# Mount the built Vite frontend
base_dir = get_base_dir()
dist_dir = os.path.join(base_dir, "dist")

if os.path.exists(dist_dir):
    api_app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")


class DesktopApi:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def save_file_dialog(self, filename: str, base64_data: str):
        try:
            if not self._window:
                return {"status": "error", "message": "Window reference not set"}

            safe_name = os.path.basename(filename or "document.pdf")
            ext = os.path.splitext(safe_name)[1].lower().lstrip(".")
            file_types = (
                (f"{ext.upper()} Files (*.{ext})", "All files (*.*)")
                if ext
                else ("All files (*.*)",)
            )
            save_dialog = webview.FileDialog.SAVE if hasattr(webview, "FileDialog") else webview.SAVE_DIALOG

            save_path = self._window.create_file_dialog(
                save_dialog,
                save_filename=safe_name,
                file_types=file_types,
            )
            if save_path:
                target = save_path[0] if isinstance(save_path, (list, tuple)) else save_path
                data = base64.b64decode(base64_data)
                with open(target, "wb") as f:
                    f.write(data)
                return {"status": "ok", "path": target}
            return {"status": "cancelled"}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}


def run_server(port: int) -> None:
    uvicorn.run(api_app, host="127.0.0.1", port=port, log_level="warning")


def main() -> None:
    webview.settings["ALLOW_DOWNLOADS"] = True

    port = find_free_port()
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()

    api = DesktopApi()
    app_url = f"http://127.0.0.1:{port}/"
    window = webview.create_window(
        title="Web PDF Studio - 现代化专业 PDF 编辑与转换套件",
        url=app_url,
        width=1400,
        height=900,
        min_size=(1024, 700),
        confirm_close=False,
        js_api=api,
    )
    api.set_window(window)
    webview.start(gui="edgechromium")


if __name__ == "__main__":
    main()
