from flask import redirect, render_template, url_for, request, Blueprint, session
from flask_login import login_required, login_user, logout_user
from app import app, data as dl
import datetime, json, sys, hashlib

#logging on file level
import logging
from app import MyLogFilter, top_log_handle
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())

bp_auth = Blueprint('auth', __name__, )

@bp_auth.route('/', methods=["GET", 'POST'])
def login():
    try:
        message = None
        if request.method == "POST":
            user = dl.user.get (('username', "c=", request.form["username"])) # c= : case sensitive comparison
            if user is not None and user.verify_password(request.form["password"]):
                login_user(user)
                log.info(f'user {user.username} logged in')
                user = dl.user.update(user, {"last_login": datetime.datetime.now()})
                session["token-login"] = False
                if not user:
                    log.error('Could not save timestamp')
                # Ok, continue
                return redirect(url_for('user.show'))
            else:
                log.error(f'{sys._getframe().f_code.co_name}: Invalid username/password')
                message = {"status": "error", "data": "Ongeldig(e) gebruikersnaam/wachtwoord"}
                return render_template('login.html', message=message)
        return render_template('login.html', message=message)
    except Exception as e:
        message = {"status": "error", "data": f"{str(e)}"}
        log.error(f'{sys._getframe().f_code.co_name}: {str(e)}')
        return render_template('login.html', message=message)

@bp_auth.route('/logout')
@login_required
def logout():
    log.info(u'User logged out')
    logout_user()
    if "token-login" in session and session["token-login"]:
        return redirect(url_for('auth.login_t'))
    return redirect(url_for('auth.login'))

SMARTSCHOOL_ALLOWED_BASE_ROLES = [
    'Andere',
    'Leerkracht',
    'Directie'
]

@bp_auth.route('/ss', methods=['POST', 'GET'])
def login_ss():
    try:
        if 'version' in request.args:
            profile = json.loads(request.args['profile'])

            if not 'username' in profile:  # not good
                log.error(f'Smartschool geeft een foutcode terug: {profile["error"]}')
                return redirect(url_for('auth.login'))

            if profile['basisrol'] in SMARTSCHOOL_ALLOWED_BASE_ROLES:
                # Students are NOT allowed to log in
                user = dl.user.get([('username', "c=" ,profile['username']), ('user_type', "=", dl.user.User.USER_TYPE.OAUTH)])
                profile['last_login'] = datetime.datetime.now()
                if user:
                    profile['first_name'] = profile['name']
                    profile['last_name'] = profile['surname']
                    user.email = profile['email']
                    user = dl.user.update(user, profile)
                else:
                    if dl.settings.get_configuration_setting('generic-new-via-smartschool'):
                        default_level = dl.settings.get_configuration_setting('generic-new-via-smartschool-default-level')
                        profile['first_name'] = profile['name']
                        profile['last_name'] = profile['surname']
                        profile['user_type'] = dl.user.User.USER_TYPE.OAUTH
                        profile['level'] = default_level
                        user = dl.user.add(profile)
                    else:
                        log.info('New users not allowed via smartschool')
                        return redirect(url_for('auth.login'))
                login_user(user)
                log.info(f'OAUTH user {user.username} logged in')
                if not user:
                    log.error('Could not save user')
                    return redirect(url_for('auth.login'))
                # Ok, continue
                return redirect(url_for('student.show'))
            elif profile['basisrol'] == "Leerling" and profile["isMainAccount"] == 0:
                # co-accounts of students are allowed to login
                profile['username'] = str(profile["nrCoAccount"]) + profile['username'] # username is the same for coaccount 1 and 2
                user = dl.user.get([('username', "c=" ,profile['username']), ('user_type', "=", dl.user.User.USER_TYPE.OAUTH)])
                profile['last_login'] = datetime.datetime.now()
                if user:
                    profile['first_name'] = profile['name'] # student name and surname
                    profile['last_name'] = profile['surname']
                    user.email = profile['email'] # parent email
                    user = dl.user.update(user, profile)
                else:
                    profile['first_name'] = profile['name']
                    profile['last_name'] = profile['surname']
                    profile['user_type'] = dl.user.User.USER_TYPE.OAUTH
                    profile['level'] = 0 # guest access
                    user = dl.user.add(profile)
                login_user(user)
                log.info(f'SS co-account user {user.username} logged in')
                # Ok, continue
                return redirect(url_for('document.showm'))
            else:
                return("<h1>Toegang verboden</h1>")
        else:
            redirect_uri = f'{app.config["SMARTSCHOOL_OUATH_REDIRECT_URI"]}/ss'
            return redirect(f'{app.config["SMARTSCHOOL_OAUTH_SERVER"]}?app_uri={redirect_uri}')
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {str(e)}')

@bp_auth.route(f'/{app.config["AUTO_LOGIN_URL"] if "AUTO_LOGIN_URL" in app.config else "NA1"}', methods=['POST', 'GET'])
def auto_login_generic():
    # remote server, generic auto login
    if "AUTO_LOGIN_URL" in app.config:
        if "AUTO_USER" in app.config:
            user = dl.user.get (('username', "c=", app.config["AUTO_USER"])) # c= : case sensitive comparison
            login_user(user)
            log.info(u'user {} logged in'.format(user.username))
            user = dl.user.update(user, {"last_login": datetime.datetime.now()})
            if not user:
                log.error('Could not save timestamp')
            return redirect(url_for('student.show'))
    return render_template('login.html', message=None)

