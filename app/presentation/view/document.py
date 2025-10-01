from flask import Blueprint, render_template, request
from flask_login import login_required, current_user
from app.presentation.view import level_0_required
import json, sys
from app import application as al, data as dl

#logging on file level
import logging
from app import MyLogFilter, top_log_handle, app
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())
bp_document = Blueprint('document', __name__)

@bp_document.route('/documentshow', methods=["GET"])
@level_0_required
@login_required
def show():
    return render_template("m/document.html")

@bp_document.route('/document/meta', methods=['GET'])
@level_0_required
def meta():
    co_account = current_user.username[0]
    username = current_user.username[1:]
    student = dl.student.get(("username", "=", username))
    if student:
        documents = dl.document.get_m([("student_id", "=", student.id), ("co_account", "=", int(co_account))])
        documents = [d.to_dict() for d in documents]
    else:
        documents = []
    return json.dumps({
        "current_user": current_user.to_dict(),
        "documents": documents
    })

@bp_document.route('/document/document', methods=['POST', "GET"])
@login_required
def document():
    try:
        ret = {}
        if request.method == "POST":
            files = request.files.getlist("attachment_file")
            document_type = request.form.get("document_type")
            username = request.form.get("username")
            al.document.add(username, document_type, files)
        if request.method == "GET":
            ret = al.document.get(request.args["id"])
        return json.dumps(ret)
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {e}')
        return json.dumps({"status": "error", "msg": str(e)})

