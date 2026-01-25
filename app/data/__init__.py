__all__ = ["user", "models", "settings", "datatables", "student", "document", "coaccount"]

import app.data.user
import app.data.models
import app.data.settings
import app.data.datatables
import app.data.student
import app.data.document
import app.data.coaccount

from app import login_manager
from flask import session

@login_manager.user_loader
def load_user(user_id):
    type = session.get("type")
    if type == "user":
        return app.data.user.load_user(user_id)
    else:
        return app.data.coaccount.load_user(user_id)
