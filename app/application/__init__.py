__all__ = ["user", "socketio", "datatables", "common", "settings", "student.py", "cron", "models", "document"]

import app.application.user
import app.application.socketio
import app.application.datatables
import app.application.common
import app.application.settings
import app.application.student
import app.application.models
import app.application.document

from app.application.student import student_cron_load_from_sdh

# tag, cront-task, label, help
cron_table = [
    ('SDH-STUDENT-UPDATE', student_cron_load_from_sdh, 'VAN SDH, upload studenten', ''),
]

import app.application.cron