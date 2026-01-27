import datetime, shutil
from pypdf import PdfWriter
from app import data as dl, application as al, app
import sys, inspect, os, io
from flask import send_from_directory, send_file

# logging on file level
import logging
from app import MyLogFilter, top_log_handle

log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())

import base64, subprocess, tempfile
from pathlib import Path

def add(request):
    try:
        document_type = request.form.get("document_type")
        username = request.form.get("username")
        coaccount_nbr = request.form.get("coaccount_nbr")

        now = str(datetime.datetime.now())[0:19]
        student = dl.student.get(("username", "=", username))
        if student:
            document = dl.document.add({
                "document_type": document_type,
                "co_account": student.co_account_1 if coaccount_nbr == "1" else student.co_account_2,
                "timestamp": now,
                "naam_voornaam": student.naam + " " + student.voornaam,
                "username": student.username,
                "roepnaam": student.roepnaam,
                "klasgroep": student.klasgroep,
                "school": student.schoolcode,
                "schooljaar": al.common.get_current_schoolyear()
            })

            if document:
                filename = f"{student.naam} {student.voornaam} {student.klasgroep} {now}".replace(" ", "-").replace(":", "-")
                if document_type == "doktersbriefje":
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
                    file_extension = file_parts[-1]

                    if file.mimetype.startswith("image/"):
                        mimetype = "application/pdf"
                        file_extension = "pdf"
                    else:
                        mimetype = file.mimetype
                    dl.document.update(document, {"name": f"{filename}.{file_extension}", "file_type": mimetype})
                    if file.mimetype.startswith("image/"):  # images are transformed into pdf
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
                            if "linux" in sys.platform:
                                weasy_bin = shutil.which("weasyprint")
                                subprocess.run([weasy_bin, str(html_path), f"documents/{filename}.{file_extension}"], check=True)
                            else:
                                subprocess.run(["C:\\Program Files\\weasyprint\\weasyprint.exe", str(html_path), f"documents/{filename}.{file_extension}"], check=True)
                    else:  # not an image, save as is
                        file.seek(0)  # make sure to read from the start
                        file.save(f"documents/{document.id}.{file_extension}")
                    log.info(f'{inspect.currentframe().f_code.co_name}: saved document "{filename}", (type) {file.content_type}, (student) {username}')
                    return {"status": "ok", "msg": "Doktersbriefje opgeslagen", "document": document.to_dict()}
                elif document_type == "ouderattest":
                    from_day = request.form.get("from_day")
                    nbr_days = int(request.form.get("nbr_days"))
                    from_day_date = datetime.datetime.strptime(from_day, "%Y-%m-%d")
                    till_day_date = from_day_date + datetime.timedelta(days=nbr_days)
                    till_day = till_day_date.strftime("%Y-%m-%d")
                    dl.document.update(document, {"name": f"{filename}.pdf", "file_type": "application/pdf", "from_day": from_day, "nbr_days": nbr_days})
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
                            subprocess.run([weasy_bin, str(html_path), f"documents/{filename}.pdf"], check=True)
                        else:
                            subprocess.run(["C:\\Program Files\\weasyprint\\weasyprint.exe", str(html_path), f"documents/{filename}.pdf"], check=True)
                    log.info(f'{inspect.currentframe().f_code.co_name}: saved ouderattest (student) {username}')
                    return {"status": "ok", "msg": "Ouderattest opgeslagen", "document": document.to_dict()}
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
    files = [open(os.path.join(document_path, d.name), "rb") for d in documents]
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

