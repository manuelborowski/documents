from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from flask_login import current_user
from app import db, log
from sqlalchemy_serializer import SerializerMixin
from app import data as dl
import app.data.models

class Coaccount(UserMixin, db.Model, SerializerMixin):
    __tablename__ = 'coaccounts'

    date_format = '%Y-%m-%d'
    datetime_format = '%Y-%m-%d %H:%M'
    serialize_rules = ("-password_hash","-url_token")

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(256))
    student = db.Column(db.String(256))
    coaccount_name = db.Column(db.String(256))
    coaccount_nbr = db.Column(db.Integer)
    timestamp = db.Column(db.DateTime())

############ user overview list #########
def filter(query_in):
    return query_in

# Set up user_loader
# @login_manager.user_loader
def load_user(user_id):
    user = Coaccount.query.get(int(user_id))
    return user

def pre_sql_query():
    return db.session.query(Coaccount)

def pre_sql_filter(query, filters):
    return query

def pre_sql_search(search_string):
    search_constraints = []
    search_constraints.append(Coaccount.username.like(search_string))
    search_constraints.append(Coaccount.naam_voornaam.like(search_string))
    return search_constraints




