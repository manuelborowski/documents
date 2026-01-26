from flask import Blueprint, render_template, request
from flask_login import login_required
from app.data.datatables import DatatableConfig
from app import data as dl
from app.presentation.view import datatable_get_data, level_5_required
import json

#logging on file level
import logging
from app import MyLogFilter, top_log_handle, app
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())
bp_account = Blueprint('coaccount', __name__)

@bp_account.route('/coaccountshow', methods=['GET'])
@login_required
@level_5_required
def show():
    return render_template("project/coaccount.html", table_config=config.create_table_config())

@bp_account.route('/coaccount/dt', methods=['POST'])
@login_required
@level_5_required
def dt():
    params = json.loads(request.data)
    return datatable_get_data(config, params)

class Config(DatatableConfig):
    def pre_sql_query(self):
        return dl.coaccount.pre_sql_query()

    def pre_sql_filter(self, q, filters):
        return dl.coaccount.pre_sql_filter(q, filters)

    def pre_sql_search(self, search):
        return dl.coaccount.pre_sql_search(search)

    width = "50%"

config = Config("coaccount", "Co-accounts")
