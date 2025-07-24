from flask import Blueprint, render_template, request
from flask_login import login_required
from app.data.datatables import DatatableConfig
from app import data as dl, application as al
from app.presentation.view import datatable_get_data, fetch_return_error, level_5_required
import json, sys

#logging on file level
import logging
from app import MyLogFilter, top_log_handle, app
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())
bp_user = Blueprint('user', __name__)

@bp_user.route('/usershow', methods=['GET', 'POST'])
@level_5_required
@login_required
def show():
    return render_template("user.html", table_config=config.create_table_config())

# invoked when the client requests data from the database
al.socketio.subscribe_on_type("user-datatable-data", lambda type, data: datatable_get_data(config, data))

@bp_user.route('/user', methods=["POST", "UPDATE", "DELETE", "GET"])
@level_5_required
@login_required
def user():
    if request.method == "UPDATE":
        data = json.loads(request.data)
        ret = al.user.update(data)
    elif request.method == "POST":
        data = json.loads(request.data)
        ret = al.user.add(data)
    elif request.method == "DELETE":
        ret = al.user.delete(request.args["ids"].split(","))
    else: # GET
        ret = al.models.get(dl.user.User, request.args)
        # ret = al.user.get(request.args)
    return json.dumps(ret)

@bp_user.route('/user/meta', methods=['GET'])
@level_5_required
@login_required
def meta():
    user_level_label = dl.user.User.level_label
    user_level_option =[{"value": k, "label": v} for k, v in user_level_label.items()]
    user_type_label = dl.user.User.type_label
    user_type_option = [{"value": k, "label": v} for k, v in user_type_label.items()]
    return json.dumps({
        "option": {"level": user_level_option, "user_type": user_type_option},
        "default": {"level": 1, "user_type": dl.user.User.USER_TYPE.LOCAL},
    })


class Config(DatatableConfig):
    def pre_sql_query(self):
        return dl.user.pre_sql_query()

    def pre_sql_filter(self, q, filters):
        return dl.user.pre_sql_filter(q, filters)

    def pre_sql_search(self, search):
        return dl.user.pre_sql_search(search)

    def format_data(self, db_list, total_count=None, filtered_count=None):
        return al.user.format_data(db_list, total_count, filtered_count)

config = Config("user", "Gebruikers")

