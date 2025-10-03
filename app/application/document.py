import datetime, base64

from app import data as dl, application as al
import sys, requests

# logging on file level
import logging
from app import MyLogFilter, top_log_handle, app

log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())


def add(username, document_type, files):
    try:
        co_account = username[0]
        username = username[1:]
        file = files[0]  # file is a werkzeug.FileStorage object
        file_parts = file.filename.split(".")
        if len(file_parts) < 2:
            log.error(f'{sys._getframe().f_code.co_name}: document without extension')
            return {"status": "error", "msg": "Bijlage moet een extensie hebben"}
        file_extension = file_parts[-1]
        student = dl.student.get(("username", "=", username))
        if student:
            document = dl.document.add({
                "document_type": document_type,
                "name": file.filename,
                "file_type": file.mimetype,
                "co_account": student.co_account_1 if co_account == "1" else student.co_account_2,
                "timestamp": datetime.datetime.now(),
                "voornaam": student.voornaam,
                "naam": student.naam,
                "username": student.username,
                "roepnaam": student.roepnaam,
                "klasgroep": student.klasgroep,
            })
            file.seek(0)  # make sure to read from the start
            file.save(f"documents/{document.id}.{file_extension}")
            log.info(f'{sys._getframe().f_code.co_name}: saved document "{file.filename}", (type) {file.content_type}, (student) {username}')
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {e}')
        return {"status": "error", "msg": str(e)}


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
