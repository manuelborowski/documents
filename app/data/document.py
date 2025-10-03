import sys
import app.data.models
from app import log, db
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy import UnicodeText

class Document(db.Model, SerializerMixin):
    __tablename__ = 'documents'

    date_format = '%Y/%m/%d'
    datetime_format = '%Y/%m/%d %H:%M:%S'

    id = db.Column(db.Integer(), primary_key=True)
    name = db.Column(db.String(256), default='')
    co_account = db.Column(db.String(256), default='')
    file_type = db.Column(db.String(256), default='')
    document_type = db.Column(db.String(256), default='')
    info = db.Column(UnicodeText, default="")
    timestamp = db.Column(db.DateTime())
    voornaam = db.Column(db.String(256), default='')
    naam = db.Column(db.String(256), default='')
    username = db.Column(db.String(256), default='')
    roepnaam = db.Column(db.String(256), default='')
    klasgroep = db.Column(db.String(256), default='')

def commit():
    return app.data.models.commit()

def add(data=None, commit=True):
    if data is None:
        data = {}
    return app.data.models.add_single(Document, data, commit)

def add_m(data=None):
    if data is None:
        data = []
    return app.data.models.add_multiple(Document, data, )

def update(obj, data=None, commit=True):
    if data is None:
        data = {}
    return app.data.models.update_single(Document, obj, data, commit)

def update_m(data=None):
    if data is None:
        data = []
    return app.data.models.update_multiple(Document, data)

def delete_m(ids=None, objs=None):
    if objs is None:
        objs = []
    if ids is None:
        ids = []
    return app.data.models.delete_multiple(Document, ids, objs)

def get_m(filters=None, fields=None, order_by=None, first=False, count=False, active=True):
    if filters is None:
        filters = []
    if fields is None:
        fields = []
    return app.data.models.get_multiple(Document, filters=filters, fields=fields, order_by=order_by, first=first, count=count, active=active)

def get(filters=None):
    if filters is None:
        filters = []
    return app.data.models.get_first_single(Document, filters)

############ obj overview list #########
def pre_sql_query():
    return db.session.query(Document)

def pre_sql_filter(query, filters):
    return query

def pre_sql_search(search_string):
    search_constraints = []
    search_constraints.append(Document.name.like(search_string))
    search_constraints.append(Document.voornaam.like(search_string))
    search_constraints.append(Document.naam.like(search_string))
    search_constraints.append(Document.info.like(search_string))
    search_constraints.append(Document.timestamp.like(search_string))
    search_constraints.append(Document.co_account.like(search_string))
    return search_constraints
