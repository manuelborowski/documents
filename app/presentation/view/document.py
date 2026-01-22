from flask import Blueprint, render_template, request
from flask_login import login_required, current_user
from app.data.datatables import DatatableConfig
from app.presentation.view import datatable_get_data
import json, sys
from user_agents import parse
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
    user_agent_str = request.headers.get('User-Agent')
    user_agent = parse(user_agent_str)
    if user_agent.is_mobile:
        return render_template("m/project/document.html")
    return render_template("project/document.html", table_config=config.create_table_config())

@bp_document.route('/document/dt', methods=['POST'])
@login_required
def dt():
    params = json.loads(request.data)
    return datatable_get_data(config, params)

@bp_document.route('/document/meta', methods=['GET'])
@login_required
def meta():
    user_agent_str = request.headers.get('User-Agent')
    user_agent = parse(user_agent_str)
    if user_agent.is_mobile:
        co_account_nbr = int(current_user.username[0])
        username = current_user.username[1:]
        student = dl.student.get(("username", "=", username))
        if student:
            documents = dl.document.get_m([("student_id", "=", student.id), (f"co_account_{co_account_nbr}", "=", student.co_account(co_account_nbr)), ("schooljaar", "=", al.common.get_current_schoolyear())], order_by="-id")
            documents = [d.to_dict() for d in documents]
            return json.dumps({"current_user": current_user.to_dict(), "student": student.to_dict(), "documents": documents,})
        return({"status": "warning", "msg": "Sorry, geen toegang!"})

    schools = dl.document.get_m(fields = ["school"], distinct=True)
    schools = [s[0] for s in schools if s[0] != None]
    return json.dumps({"schools": schools})

@bp_document.route('/document', methods=['POST', "GET"])
@login_required
def document():
    if request.method == "POST":
        ret = al.document.add(request)
    else: # GET
        ret = al.document.get(request)
    return json.dumps(ret)


class Config(DatatableConfig):
    def pre_sql_query(self):
        return dl.document.pre_sql_query()

    def pre_sql_filter(self, query, filters):
        return dl.document.pre_sql_filter(query, filters)

    def pre_sql_search(self, search):
        return dl.document.pre_sql_search(search)

config = Config("document", "Documenten")
