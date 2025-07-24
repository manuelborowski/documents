import logging.handlers, os, sys
from flask import Flask
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, current_user
from flask_jsglue import JSGlue
from flask_migrate import Migrate
from flask_apscheduler import APScheduler
from werkzeug.routing import IntegerConverter

#Warning: update flask_jsglue.py: from markupsafe import Markup

# 0.1 copy from tickoff V0.27
# 0.2: implemented lists
# 0.3: added page "deelnemers".  Contestants are loaded from SDH.
# 0.4: deelnemers page, add option to assign new RFID code
# 0.5: updated user-levels.  Clean up pages/menus and associated levels.
# 0.6: removed obsolete files
# 0.7: add spare badges

version = "0.7"

app = Flask(__name__, instance_relative_config=True, template_folder='presentation/template/')

#  enable logging
top_log_handle = "TICKOFF"
log = logging.getLogger(f"{top_log_handle}.{__name__}")
# support custom filtering while logging
class MyLogFilter(logging.Filter):
    def filter(self, record):
        record.username = current_user.username if current_user and current_user.is_active else 'NONE'
        return True
log.addFilter(MyLogFilter())
LOG_FILENAME = os.path.join(sys.path[0], f'log/stopwatch.txt')
log_level = getattr(logging, 'INFO')
log.setLevel(log_level)
log_handler = logging.handlers.RotatingFileHandler(LOG_FILENAME, maxBytes=1024 * 1024, backupCount=20, encoding="utf-8")
log_formatter = logging.Formatter(u'%(asctime)s - %(levelname)s - %(username)s - %(message)s')
log_handler.setFormatter(log_formatter)
log.addHandler(log_handler)

log.info("START Stopwatch")

from app.config import app_config
config_name = os.getenv('FLASK_CONFIG')
config_name = config_name if config_name else 'production'
app.config.from_object(app_config[config_name])
app.config.from_pyfile('config.py')

jsglue = JSGlue(app)
db = SQLAlchemy()
login_manager = LoginManager()
db.app = app  #  hack:-(
db.init_app(app)
migrate = Migrate(app, db)

app.url_map.converters['int'] = IntegerConverter
login_manager.init_app(app)
login_manager.login_message = 'Je moet aangemeld zijn om deze pagina te zien!'
login_manager.login_view = 'auth.login'

socketio = SocketIO(app, async_mode=app.config['SOCKETIO_ASYNC_MODE'], cors_allowed_origins="*")


def default_db_entries():
    with app.app_context():
        try:
            from app.data.user import User
            from app import data as dl
            # create default accounts, if not present
            for user in app.config["DEFAULT_USERS"]:
                find_user = User.query.filter(User.username == user[0]).first()
                if not find_user:
                    new_user = User(username=user[0], password=user[1], level=user[2], user_type=User.USER_TYPE.LOCAL)
                    db.session.add(new_user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            log.error(f'{sys._getframe().f_code.co_name}: {e}')

default_db_entries()

SCHEDULER_API_ENABLED = True
ap_scheduler = APScheduler()
ap_scheduler.init_app(app)
ap_scheduler.start()

# Should be last to avoid circular import
from app.presentation.view import auth, api, user, settings, list, person, spare
app.register_blueprint(auth.bp_auth)
app.register_blueprint(api.bp_api)
app.register_blueprint(user.bp_user)
app.register_blueprint(settings.bp_settings)
app.register_blueprint(list.bp_list)
app.register_blueprint(person.bp_person)
app.register_blueprint(spare.bp_spare)
