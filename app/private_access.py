"""Client IP policy shared by login and existing sessions."""
from ipaddress import ip_address

from flask import abort, request, session
from flask_login import current_user, login_user as flask_login_user, logout_user


def user_ip_allowed(user, address):
    from app.data.coaccount import Coaccount

    if user is None:
        return False
    # Smartschool's Leerling flow authenticates students and their coaccounts.
    if isinstance(user, Coaccount):
        return True
    try:
        address = ip_address(address)
    except (ValueError, TypeError):
        return False
    return address.is_private or bool(user.remote)


def request_ip_allowed(user):
    # nginx must overwrite X-Real-IP; only nginx should reach the backend.
    return user_ip_allowed(user, request.headers.get("X-Real-IP", request.remote_addr))


def login_user(user, **kwargs):
    from app.data.coaccount import Coaccount

    if not request_ip_allowed(user):
        logout_user()
        session.pop("type", None)
        return False
    authenticated = flask_login_user(user, **kwargs)
    if authenticated:
        session["type"] = "coaccount" if isinstance(user, Coaccount) else "user"
    return authenticated


def enforce_user_ip():
    if current_user.is_authenticated and not request_ip_allowed(current_user):
        logout_user()
        session.pop("type", None)
        abort(403, description="Aanmelden vanaf dit IP-adres is niet toegestaan")
