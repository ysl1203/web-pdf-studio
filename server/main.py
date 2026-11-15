import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.concurrency import run_in_threadpool
from pdf2docx import Converter

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB safety limit
LOCALHOST_ORIGIN_REGEX = r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$"


def _convert_sync(input_pdf_path: str, output_docx_path: str) -> None:
    """Run CPU-bound pdf2docx conversion and guarantee handle cleanup."""
    cv = Converter(input_pdf_path)
    try:
        cv.convert(output_docx_path, start=0, end=None)
    finally:
        cv.close()


def configure_cors(app: FastAPI) -> None:
    """Restrict CORS strictly to local loopback origins without credentials."""
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=LOCALHOST_ORIGIN_REGEX,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )


def register_pdf_routes(app: FastAPI, engine_label: str = "pdf2docx + PyMuPDF") -> None:
    """Attach health and PDF-to-DOCX conversion endpoints to a FastAPI app."""

    @app.get("/api/health")
    def health_check():
        return {
            "status": "online",
            "service": "pdf-converter-service",
            "engine": engine_label,
            "features": ["pdf-to-docx", "table-reconstruction", "layout-analysis"],
        }

    @app.post("/api/convert/pdf-to-docx")
    async def convert_pdf_to_docx(
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
    ):
        raw_name = os.path.basename(file.filename or "document.pdf")
        if not raw_name.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded PDF file is empty.")
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="PDF file exceeds 100 MB limit.")
        if not content.lstrip()[:8].startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="Invalid PDF file signature.")

        temp_dir = tempfile.mkdtemp(prefix="web_pdf_studio_")
        input_pdf_path = os.path.join(temp_dir, "input.pdf")
        output_docx_path = os.path.join(temp_dir, "output.docx")

        try:
            with open(input_pdf_path, "wb") as f:
                f.write(content)

            await run_in_threadpool(_convert_sync, input_pdf_path, output_docx_path)

            if not os.path.exists(output_docx_path):
                shutil.rmtree(temp_dir, ignore_errors=True)
                return JSONResponse(status_code=500, content={"error": "DOCX conversion produced no output."})

            base_name = os.path.splitext(raw_name)[0] or "document"
            download_name = f"{base_name}.docx"

            background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)
            return FileResponse(
                path=output_docx_path,
                filename=download_name,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        except Exception as exc:
            shutil.rmtree(temp_dir, ignore_errors=True)
            return JSONResponse(status_code=500, content={"error": str(exc)})


app = FastAPI(title="Web PDF Studio - Conversion Microservice")
configure_cors(app)
register_pdf_routes(app, engine_label="pdf2docx + PyMuPDF")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
