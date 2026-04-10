import datetime, shutil
from pypdf import PdfWriter
from app import data as dl, application as al, app
import sys, inspect, os, io
from flask import send_from_directory, send_file
from flask_login import current_user

# logging on file level
import logging
from app import MyLogFilter, top_log_handle

log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())

import base64, subprocess, tempfile
from pathlib import Path

# Document capture: scan (take or upload a photo), copy-paste (from a print-screen) or form (fill out a form)
# Scan and copy-paste is a photo of the document
# Creator: staff or parent (could be student in case of medisch attest)
# Types of documents:
#               medisch attest | ouderattest | code-R | code-P
# scan        |    S / P       |    S        |    S   |   S
# copy-paste  |    S           |    S        |    S   |   S
# form        |    X           |    P        |    X   |   X

def __pdf_from_scan(request, document, filename, student):
    # jpg image (scan or uploaded photo)
    from_day = document.from_day
    nbr_days = document.nbr_days
    till_day_date = from_day + datetime.timedelta(days=(nbr_days- 1))
    till_day = till_day_date.strftime("%Y-%m-%d")
    files = request.files.getlist("attachment_file")
    file = files[0]  # file is a werkzeug.FileStorage object
    if app.config["LOG_LEVEL"] == "DEBUG":
        imagesize = file.stream.seek(0, 2)
        log.debug(f'{inspect.currentframe().f_code.co_name}: id: {student.informatnummer}, JPG-size: {imagesize}')
        file.stream.seek(0)
    file_parts = file.filename.split(".")
    if len(file_parts) < 2:
        log.error(f'{inspect.currentframe().f_code.co_name}: document without extension')
        return {"status": "error", "msg": "Bijlage moet een extensie hebben"}
    if not file.mimetype.startswith("image/"):
        log.error(f'{inspect.currentframe().f_code.co_name}: only images allowed')
        return {"status": "error", "msg": "Bijlage mag alleen een beeldbestand zijn"}
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
                {student.naam} {student.voornaam} {student.klasgroep} {from_day} - {till_day}<br>
                <img src="{data_uri}" alt="">
            </body>
        </html>
        """
    with tempfile.TemporaryDirectory() as tmpdir:
        html_path = Path(tmpdir) / "index.html"
        html_path.write_text(html, encoding="utf-8")
        if "linux" in sys.platform:
            weasy_bin = shutil.which("weasyprint")
            subprocess.run([weasy_bin, str(html_path), f"documents/{filename}"], check=True)
        else:
            subprocess.run(["C:\\Program Files\\weasyprint\\weasyprint.exe", str(html_path), f"documents/{filename}"], check=True)
    log.info(f'{inspect.currentframe().f_code.co_name}: saved document "{filename}", (type) {file.content_type}, (student) {student.username}')
    return {"status": "ok", "msg": "Attest opgeslagen", "document": document.to_dict()}

def __pdf_from_form(document, filename, student):
    # filled in form -> generate pdf
    now = datetime.datetime.now()
    from_day = document.from_day
    nbr_days = document.nbr_days
    till_day_date = from_day + datetime.timedelta(days=(nbr_days- 1))
    till_day = till_day_date.strftime("%Y-%m-%d")
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
        if "linux" in sys.platform:
            weasy_bin = shutil.which("weasyprint")
            subprocess.run([weasy_bin, str(html_path), f"documents/{filename}"], check=True)
        else:
            subprocess.run(["C:\\Program Files\\weasyprint\\weasyprint.exe", str(html_path), f"documents/{filename}"], check=True)
    log.info(f'{inspect.currentframe().f_code.co_name}: saved ouderattest (student) {student.username}')
    return {"status": "ok", "msg": "Attest opgeslagen", "document": document.to_dict()}

def add(request):
    try:
        document_type = request.form.get("document_type")
        document_scan = request.form.get("document_scan", False) == "true" # photo, i.e. scan, upload or copy-paste
        username = request.form.get("username")
        coaccount_nbr = int(request.form.get("coaccount_nbr"))
        from_day = request.form.get("from_day")
        nbr_days = int(request.form.get("nbr_days"))

        now = str(datetime.datetime.now())[0:19]
        student = dl.student.get(("username", "=", username))
        if student:
            # 5 is a special case where staff adds a document
            if coaccount_nbr == 5:
                coaccount_name = current_user.username
            else:
                coaccount = dl.models.get(dl.coaccount.Coaccount, [('username', "c=", username), ('coaccount_nbr', "=", coaccount_nbr)])
                coaccount_name = coaccount.coaccount_name
            filename = f"{student.naam}{student.voornaam}-{student.klasgroep}-{app.config["DOCUMENT_TYPE_LABELS"][document_type]}-{from_day}.pdf".replace(" ", "").replace(":", "-")
            document = dl.document.add({
                "document_type": document_type,
                "co_account": coaccount_name,
                "timestamp": now,
                "naam_voornaam": student.naam + " " + student.voornaam,
                "username": student.username,
                "roepnaam": student.roepnaam,
                "klasgroep": student.klasgroep,
                "school": student.schoolcode,
                "schooljaar": al.common.get_current_schoolyear(),
                "nbr_days": nbr_days,
                "from_day": from_day,
                "name": filename
            })
            if document:
                if document_scan:
                    return __pdf_from_scan(request, document, filename, student)
                else:
                    return __pdf_from_form(document, filename, student)
            log.error(f'{inspect.currentframe().f_code.co_name}: Could not save document')
            return {"status": "error", "msg": "Fout, document niet opgeslagen"}
    except Exception as e:
        log.error(f'{inspect.currentframe().f_code.co_name}: {e}')
        return {"status": "error", "msg": str(e)}

def get(request):
    documents = []
    try:
        documents = al.models.get(dl.document.Document, request.args)
        for document in documents:
            with open(f"documents/{document["name"]}", "rb") as file:
                document["file"] = base64.b64encode(file.read()).decode('utf-8')
        return documents
    except Exception as e:
        log.error(f'{inspect.currentframe().f_code.co_name}: {documents}, {e}')
        return {"status": "error", "msg": {str(e)}}

# Don't delete but set active to False
def delete(ids):
    try:
        documents = dl.models.get_m(dl.document.Document, ("id", "in", ids))
        for document in documents:
            document.active = False
        dl.models.commit()
        return {"status": "ok", "msg": "Documenten zijn verwijderd"}
    except Exception as e:
        log.error(f'{inspect.currentframe().f_code.co_name}: {e}')
        return {"status": "error", "msg": str(e)}

def export(ids):
    documents = dl.models.get_m(dl.document.Document, ("id", "in", ids))
    document_path = os.path.join(f"{app.root_path}", "..", "documents")
    files = [open(os.path.join(document_path, d.name), "rb") for d in documents if os.path.exists(os.path.join(document_path, d.name))]
    merger = PdfWriter()
    try:
        if len(documents) == 1:
            return send_from_directory(document_path, documents[0].name, as_attachment=True)
        pdf_bytes_list = [f.read() for f in files]
        for b in pdf_bytes_list:
            merger.append(io.BytesIO(b))  # append accepts file-like objects
        out = io.BytesIO()
        merger.write(out)
        out.seek(0)
        now = str(datetime.datetime.now())[0:19].replace(":", "-")
        return send_file(out, as_attachment=True, download_name=f"document-{now}.pdf", mimetype="application/pdf")
    except Exception as e:
        log.error(f'{inspect.currentframe().f_code.co_name}: {e}')
        return {"Er ging iets fout, waarschuw ICT"}
    finally:
        merger.close()
        [f.close() for f in files]

