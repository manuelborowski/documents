from flask import Blueprint, render_template, request
from flask_login import login_required

from app.data.datatables import DatatableConfig
from app import data as dl, application as al
from app.presentation.view import datatable_get_data, fetch_return_error, level_3_required
import json, sys

#logging on file level
import logging
from app import MyLogFilter, top_log_handle, app
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())
bp_student = Blueprint('student', __name__)

@bp_student.route('/studentshow', methods=['GET', 'POST'])
@level_3_required
@login_required
def show():
    return render_template("student.html", table_config=config.create_table_config())

# invoked when the client requests data from the database
al.socketio.subscribe_on_type("student-datatable-data", lambda type, data: datatable_get_data(config, data))

@bp_student.route('/student', methods=["POST", "UPDATE", "DELETE", "GET"])
@level_3_required
@login_required
def student():
    ret = {}
    if request.method == "GET":
        ret = al.models.get(dl.student.Student, request.args)
    if request.method == "UPDATE":
        data = json.loads(request.data)
        ret = al.student.update(data)
    return json.dumps(ret)

@bp_student.route('/student/meta', methods=['GET'])
@level_3_required
@login_required
def meta():
    return json.dumps({})


class Config(DatatableConfig):
    def pre_sql_query(self):
        return dl.student.pre_sql_query()

    def pre_sql_filter(self, query, filters):
        return dl.student.pre_sql_filter(query, filters)

    def pre_sql_search(self, search):
        return dl.student.pre_sql_search(search)

    def format_data(self, db_list, total_count=None, filtered_count=None):
        return al.student.format_data(db_list, total_count, filtered_count)

    def post_sql_order(self, l, on, direction):
        return al.student.post_sql_order(l, on, direction)

    def post_sql_filter(self, l, filter, count):
        return al.student.post_sql_filter(l, filter, count)

config = Config("student", "Studenten")

