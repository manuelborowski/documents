from app import data as dl
import datetime, sys

#logging on file level
import logging
from app import MyLogFilter, top_log_handle
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())

def get_api_key(level, tag="local"):
    api_keys = dl.settings.get_configuration_setting('api-keys')[level - 1]
    api_key = [k for k, v in api_keys.items() if v == tag][0]
    return api_key

def ini2timedelta(ini_string):
    try:
        init_format = ['days', 'hours', 'minutes', 'seconds']
        return datetime.timedelta(**{k: v for k, v in zip(init_format, [int(i) for i in ini_string.split(",")])})
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {e}')

# format returns the schoolyear in a certain format, e.g. for the schoolyear 2023-2024, format:
# 1: return 2023
# 2: return 2023-24 (string)
# 3: return 2023-2024 (string)
def get_current_schoolyear(format=1, schoolyear=None):
    if schoolyear is None:
        now = datetime.datetime.now()
        # new schoolyear starts the first of july
        schoolyear = now.year - 1 if now.month <= 6 else now.year
    if format == 2:
        return f"{schoolyear}-{(schoolyear - int(schoolyear / 100) * 100 + 1) % 100}"
    elif format == 3:
        return f"{schoolyear}-{schoolyear + 1}"
    return schoolyear



