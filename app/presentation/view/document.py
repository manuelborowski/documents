from flask import Blueprint, render_template, request
from flask_login import login_required, current_user
from app.data.datatables import DatatableConfig
from app.presentation.view import datatable_get_data, level_0_required
import json, sys
from app import application as al, data as dl

#logging on file level
import logging
from app import MyLogFilter, top_log_handle, app
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())
bp_document = Blueprint('document', __name__)

@bp_document.route('/documentshow', methods=["GET"])
@login_required
def show():
    return render_template("document.html", table_config=config.create_table_config())

# invoked when the client requests data from the database
al.socketio.subscribe_on_type("document-datatable-data", lambda type, data: datatable_get_data(config, data))

def value_update(type, data):
    document = dl.document.get(("id", "=", data["id"]))
    dl.document.update(document, {data["column"]: data["value"]})

# invoked when a single cell in the table is updated
al.socketio.subscribe_on_type("document-cell-update", value_update)

@bp_document.route('/document/meta', methods=['GET'])
@login_required
def meta():
    schools = dl.document.get_m(fields = ["school"], distinct=True)
    schools = [s[0] for s in schools if s[0] != None]
    return json.dumps({
        "schools": schools
    })

@bp_document.route('/document/document', methods=['POST', "GET"])
@login_required
def document():
    try:
        ret = {}
        if request.method == "POST":
            ret = al.document.add(request)
        if request.method == "GET":
            ret = al.document.get(request.args["id"])
        return json.dumps(ret)
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {e}')
        return json.dumps({"status": "error", "msg": str(e)})

class Config(DatatableConfig):
    def pre_sql_query(self):
        return dl.document.pre_sql_query()

    def pre_sql_filter(self, query, filters):
        return dl.document.pre_sql_filter(query, filters)

    def pre_sql_search(self, search):
        return dl.document.pre_sql_search(search)

config = Config("document", "Documenten")

@bp_document.route('/documentshowm', methods=["GET"])
@level_0_required
@login_required
def showm():
    return render_template("m/document.html")

@bp_document.route('/document/metam', methods=['GET'])
@level_0_required
def metam():
    co_account_nbr = int(current_user.username[0])
    username = current_user.username[1:]
    student = dl.student.get(("username", "=", username))
    if student:
        documents = dl.document.get_m([("student_id", "=", student.id),
                                       (f"co_account_{co_account_nbr}", "=", student.co_account(co_account_nbr)),
                                        ("schooljaar", "=", al.common.get_current_schoolyear())], order_by="-id")
        documents = [d.to_dict() for d in documents]
    else:
        documents = []
    return json.dumps({
        "current_user": current_user.to_dict(),
        "student": student.to_dict(),
        "documents": documents,
    })

