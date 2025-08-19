from flask import Blueprint, render_template, request
from flask_login import login_required

import app.application.socketio
from app.data.datatables import DatatableConfig
from app import data as dl, application as al
from app.presentation.view import datatable_get_data, fetch_return_error, level_5_required
import json, sys

#logging on file level
import logging
from app import MyLogFilter, top_log_handle, app
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())
bp_person = Blueprint('person', __name__)

@bp_person.route('/personshow', methods=['GET', 'POST'])
@login_required
def show():
    return render_template("person.html", table_config=config.create_table_config())

# invoked when the client requests data from the database
al.socketio.subscribe_on_type("person-datatable-data", lambda type, data: datatable_get_data(config, data))

@bp_person.route('/person', methods=["POST", "UPDATE", "DELETE", "GET"])
@login_required
def person():
    ret = {}
    if request.method == "GET":
        ret = al.models.get(dl.person.Person, request.args)
    if request.method == "UPDATE":
        data = json.loads(request.data)
        ret = al.person.update(data)
    return json.dumps(ret)

@bp_person.route('/person/meta', methods=['GET'])
@login_required
def meta():
    return json.dumps({})


class Config(DatatableConfig):
    def pre_sql_query(self):
        return dl.person.pre_sql_query()

    def pre_sql_filter(self, query, filters):
        return dl.person.pre_sql_filter(query, filters)

    def pre_sql_search(self, search):
        return dl.person.pre_sql_search(search)

    def format_data(self, db_list, total_count=None, filtered_count=None):
        return al.person.format_data(db_list, total_count, filtered_count)

    def post_sql_order(self, l, on, direction):
        return al.person.post_sql_order(l, on, direction)

    def post_sql_filter(self, l, filter, count):
        return al.person.post_sql_filter(l, filter, count)

config = Config("person", "Personen")

