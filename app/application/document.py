import datetime, base64

from app import data as dl, application as al
import sys, requests

# logging on file level
import logging
from app import MyLogFilter, top_log_handle, app

log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())

import base64, subprocess, tempfile
from pathlib import Path

def image_filestorage_to_pdf(file_storage, out_pdf_path):
    # Ensure it's an image
    mime = file_storage.mimetype or "application/octet-stream"
    if not mime.startswith("image/"):
        raise ValueError("Uploaded file is not an image")

    # Read bytes (and rewind so caller can reuse the stream if needed)
    img_bytes = file_storage.read()
    file_storage.stream.seek(0)

    # Build data URI
    b64 = base64.b64encode(img_bytes).decode("ascii")
    data_uri = f"data:{mime};base64,{b64}"

    # Minimal HTML that scales the image to the page
    html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin-top: 5mm; }}      /* set page size/margins as you like */
  html, body {{ margin: 0; padding: 0; }}
  img {{ width: 90%; height: 90%; }}
</style>
</head>
<body>
  <img src="{data_uri}" alt="">
</body>
</html>"""

    # Write HTML to a temp file and run WeasyPrint
    with tempfile.TemporaryDirectory() as tmpdir:
        html_path = Path(tmpdir) / "index.html"
        html_path.write_text(html, encoding="utf-8")

        subprocess.run(
            ["C:\\Program Files\\weasyprint\\weasyprint.exe", str(html_path), str(out_pdf_path)],
            check=True
        )

def add(request):
    try:
        document_type = request.form.get("document_type")
        username = request.form.get("username")
        co_account = username[0]
        username = username[1:]

        now = datetime.datetime.now()
        student = dl.student.get(("username", "=", username))
        if student:
            document = dl.document.add({
                "document_type": document_type,
                "co_account": student.co_account_1 if co_account == "1" else student.co_account_2,
                "timestamp": now,
                "voornaam": student.voornaam,
                "naam": student.naam,
                "username": student.username,
                "roepnaam": student.roepnaam,
                "klasgroep": student.klasgroep,
                "school": student.schoolcode,
                "schooljaar": al.common.get_current_schoolyear()
            })

            if document:
                if document_type == "doktersbriefje":
                    files = request.files.getlist("attachment_file")
                    file = files[0]  # file is a werkzeug.FileStorage object
                    file_parts = file.filename.split(".")
                    if len(file_parts) < 2:
                        log.error(f'{sys._getframe().f_code.co_name}: document without extension')
                        return {"status": "error", "msg": "Bijlage moet een extensie hebben"}
                    file_extension = file_parts[-1]
                    file_base = file_parts[0]

                    if file.mimetype.startswith("image/"):
                        mimetype = "application/pdf"
                        file_extension = "pdf"
                    else:
                        mimetype = file.mimetype
                    dl.document.update(document, {"name": f"{file_base}.{file_extension}", "file_type": mimetype})
                    if file.mimetype.startswith("image/"): # images are transformed into pdf
                        img_bytes = file.read()
                        file.stream.seek(0)
                        b64 = base64.b64encode(img_bytes).decode("ascii")
                        data_uri = f"data:{file.mimetype};base64,{b64}"
                        html = f"""
                            <!doctype html>
                            <html>
                                <head>
                                    <meta charset="utf-8">
                                    <style>
                                          @page {{ size: A4; margin: 5mm; }}      /* set page size/margins as you like */
                                          html, body {{ margin: 0; padding: 0; }}
                                          img {{ width: 75%; height: 75%; }}
                                    </style>
                                </head>
                                <body>
                                    {student.naam} {student.voornaam} {student.klasgroep} {now}<br>
                                    <img src="{data_uri}" alt="">
                                </body>
                            </html>
                            """
                        with tempfile.TemporaryDirectory() as tmpdir:
                            html_path = Path(tmpdir) / "index.html"
                            html_path.write_text(html, encoding="utf-8")
                            subprocess.run(["C:\\Program Files\\weasyprint\\weasyprint.exe", str(html_path), f"documents/{document.id}.{file_extension}"], check=True)
                    else: # not an image, save as is
                        file.seek(0)  # make sure to read from the start
                        file.save(f"documents/{document.id}.{file_extension}")
                    log.info(f'{sys._getframe().f_code.co_name}: saved document "{file.filename}", (type) {file.content_type}, (student) {username}')
                    return {"status": True, "msg": "Doktersbriefje opgeslagen", "document": document.to_dict()}
                elif document_type == "ouderattest":
                    from_day = request.form.get("from_day")
                    nbr_days = int(request.form.get("nbr_days"))
                    from_day_date = datetime.datetime.strptime(from_day, "%Y-%m-%d")
                    till_day_date = from_day_date + datetime.timedelta(days=nbr_days)
                    till_day = till_day_date.strftime("%Y-%m-%d")
                    dl.document.update(document, {"name": f"{now}.pdf", "file_type": "application/pdf", "from_day": from_day, "nbr_days": nbr_days})
                    html = f"""
                        <!doctype html>
                        <html>
                            <head>
                                <meta charset="utf-8">
                                <style>
                                      @page {{ size: A4; margin: 5mm; }}      /* set page size/margins as you like */
                                      html, body {{ margin: 0; padding: 0; }}
                                      img {{ width: 75%; height: 75%; }}
                                </style>
                            </head>
                            <body style="font-size: xx-large;">
                                <h1><b>Ouderattest bij ziekte</b></h1>
                                <b>Datum:</b> {now}<br>
                                <b>Naam:</b> {student.naam}<br>
                                <b>Voornaam:</b> {student.voornaam}<br>
                                <b>Klas:</b> {student.klasgroep}<br>
                                <b>Was afwezig wegens ziekte op:</b> {from_day if nbr_days == 1 else ""}<br>
                                <b>Was afwezig wegens ziekte vanaf:</b> {from_day if nbr_days > 1 else ""}<br>
                                <b>Tot en met:</b> {till_day if nbr_days > 1 else ""}<br>
                                <b>Naam van de ouder:</b> {document.co_account}<br>
                            </body>
                        </html>
                        """
                    with tempfile.TemporaryDirectory() as tmpdir:
                        html_path = Path(tmpdir) / "index.html"
                        html_path.write_text(html, encoding="utf-8")
                        subprocess.run(["C:\\Program Files\\weasyprint\\weasyprint.exe", str(html_path), f"documents/{document.id}.pdf"], check=True)
                    log.info(f'{sys._getframe().f_code.co_name}: saved ouderattest (student) {username}')
                    return {"status": True, "msg": "Ouderattest opgeslagen", "document": document.to_dict()}
            log.error(f'{sys._getframe().f_code.co_name}: Could not save document')
            return {"status": False, "msg": "Fout, document niet opgeslagen"}
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {e}')
        return {"status": False, "msg": str(e)}

def get(id):
    try:
        data = None
        document = dl.document.get(("id", "=", id))
        data = document.to_dict()
        file_parts = document.name.split(".")
        file_extension = file_parts[-1]
        with open(f"documents/{document.id}.{file_extension}", "rb") as file:
            data["file"] = base64.b64encode(file.read()).decode('utf-8')
        return data
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {data}, {e}')
        return {"status": "error", "msg": {str(e)}}
