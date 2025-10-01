from app import data as dl, application as al
import sys, requests

# logging on file level
import logging
from app import MyLogFilter, top_log_handle, app

log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())

def update(data):
    try:
        return {"status": "error", "msg": f"Onbekende operatie: {data}"}
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {data}, {e}')
        return {"status": "error", "msg": str(e)}


######################### CRON HANDLERS ##################################
def student_cron_load_from_sdh(opaque=None, **kwargs):
    log.info(f"{sys._getframe().f_code.co_name}, START")
    try:
        updated_students = []
        nbr_updated = 0
        new_students = []
        sdh_key = app.config["SDH_API_KEY"]
        # get the klassen and klasgroepen
        klas2klasgroep = {}
        res = requests.get(app.config["SDH_GET_KLAS_URL"], headers={'x-api-key': sdh_key})
        if res.status_code == 200:
            sdh_klassen = res.json()
            if sdh_klassen['status']:
                log.info(f'{sys._getframe().f_code.co_name}, retrieved {len(sdh_klassen["data"])} klassen from SDH')
                klas2klasgroep = {k["klascode"]: k["klasgroepcode"] for k in sdh_klassen["data"]}

        # check for new, updated or deleted students
        sdh_student_url = app.config["SDH_GET_STUDENT_URL"]
        res = requests.get(sdh_student_url, headers={'x-api-key': sdh_key})
        if res.status_code == 200:
            sdh_students = res.json()
            if sdh_students['status']:
                log.info(f'{sys._getframe().f_code.co_name}, retrieved {len(sdh_students["data"])} students from SDH')
                db_students = dl.student.get_m(("klasgroep", "!", "Leerkracht"))
                db_informatnummer_to_student = {s.informatnummer: s for s in db_students}
                for sdh_student in sdh_students["data"]:
                    if sdh_student["leerlingnummer"] in db_informatnummer_to_student:
                        # check for changed rfid or classgroup
                        db_student = db_informatnummer_to_student[sdh_student["leerlingnummer"]]
                        update = {}
                        klas = sdh_student["klascode"]
                        klasgroep = klas2klasgroep[klas]
                        if db_student.rfid != sdh_student["rfid"]:
                            update["rfid"] = sdh_student["rfid"]
                        if db_student.klasgroep != klasgroep:
                            update["klasgroep"] = klasgroep
                        if db_student.instellingsnummer != sdh_student["instellingsnummer"]:
                            update["instellingsnummer"] = sdh_student["instellingsnummer"]
                        if db_student.username != sdh_student["username"]:
                            update["username"] = sdh_student["username"]
                        if update:
                            update.update({"item": db_student})
                            updated_students.append(update)
                            log.info(f'{sys._getframe().f_code.co_name}, Update student {db_student.informatnummer}, update {update}')
                            nbr_updated += 1
                        del (db_informatnummer_to_student[sdh_student["leerlingnummer"]])
                    else:
                        new_student = {"informatnummer": sdh_student["leerlingnummer"], "klasgroep": klas2klasgroep[sdh_student["klascode"]],
                                       "instellingsnummer": sdh_student["instellingsnummer"], "roepnaam": sdh_student["roepnaam"], "naam": sdh_student["naam"],
                                       "voornaam": sdh_student["voornaam"], "rfid": sdh_student["rfid"], "geslacht": sdh_student["geslacht"], "username": sdh_student["username"]}
                        new_students.append(new_student)
                        log.info(f'{sys._getframe().f_code.co_name}, New student {sdh_student["leerlingnummer"]}')
                deleted_students = [v for (k, v) in db_informatnummer_to_student.items()]
                for student in deleted_students:
                    log.info(f'{sys._getframe().f_code.co_name}, Delete student {student.informatnummer}')
                dl.student.add_m(new_students)
                dl.student.update_m(updated_students)
                dl.student.delete_m(objs=deleted_students)
                log.info(f'{sys._getframe().f_code.co_name}, Students add {len(new_students)}, update {nbr_updated}, delete {len(deleted_students)}')
            else:
                log.info(f'{sys._getframe().f_code.co_name}, error retrieving students from SDH, {sdh_students["data"]}')
        else:
            log.error(f'{sys._getframe().f_code.co_name}: api call to {sdh_student_url} returned {res.status_code}')

        updated_students = []
        nbr_updated = 0
        new_students = []
        # check for new, updated or deleted staff
        sdh_staff_url = app.config["SDH_GET_STAFF_URL"]
        res = requests.get(sdh_staff_url, headers={'x-api-key': sdh_key})
        if res.status_code == 200:
            sdh_staffs = res.json()
            if sdh_staffs['status']:
                log.info(f'{sys._getframe().f_code.co_name}, retrieved {len(sdh_staffs["data"])} staffs from SDH')
                db_students = dl.student.get_m(("klasgroep", "=", "Leerkracht"))
                db_informatnummer_to_staff = {s.informatnummer: s for s in db_students}
                for sdh_staff in sdh_staffs["data"]:
                    if sdh_staff["informat_id"] in ["", None]: continue
                    if sdh_staff["informat_id"] in db_informatnummer_to_staff:
                        # check for changed rfid
                        db_staff = db_informatnummer_to_staff[sdh_staff["informat_id"]]
                        update = {}
                        if db_staff.rfid != sdh_staff["rfid"]:
                            update["rfid"] = sdh_staff["rfid"]
                        if update:
                            update.update({"item": db_staff})
                            updated_students.append(update)
                            log.info(f'{sys._getframe().f_code.co_name}, Update staff {db_staff.informatnummer}, update {update}')
                            nbr_updated += 1
                        del (db_informatnummer_to_staff[sdh_staff["informat_id"]])
                    else:
                        new_staff = {"informatnummer": sdh_staff["informat_id"], "klasgroep": "Leerkracht", "roepnaam": sdh_staff["voornaam"],
                                     "naam": sdh_staff["naam"], "voornaam": sdh_staff["voornaam"], "rfid": sdh_staff["rfid"], "geslacht": sdh_staff["geslacht"]}
                        new_students.append(new_staff)
                        log.info(f'{sys._getframe().f_code.co_name}, New staff {sdh_staff["informat_id"]}')
                deleted_students = [v for (k, v) in db_informatnummer_to_staff.items()]
                for student in deleted_students:
                    log.info(f'{sys._getframe().f_code.co_name}, Delete staff {student.informatnummer}')
                dl.student.add_m(new_students)
                dl.student.update_m(updated_students)
                dl.student.delete_m(objs=deleted_students)
                log.info(f'{sys._getframe().f_code.co_name}, Staff add {len(new_students)}, update {nbr_updated}, delete {len(deleted_students)}')
            else:
                log.info(f'{sys._getframe().f_code.co_name}, error retrieving staff from SDH, {sdh_staffs["data"]}')
        else:
            log.error(f'{sys._getframe().f_code.co_name}: api call to {sdh_staff_url} returned {res.status_code}')

        log.info(f"{sys._getframe().f_code.co_name}, STOP")
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {e}')

######################### DATATABLE HELPERS ##############################
def format_data(db_list, total_count=None, filtered_count=None):
    out = []
    for i in db_list:
        em = i.to_dict()
        em.update({"row_action": i.id, "DT_RowId": i.id})
        out.append(em)
    return total_count, filtered_count, out

def post_sql_order(l, on, direction):
    l.sort(reverse=direction == "desc", key=lambda x: x[on])
    return l

def post_sql_filter(item_list, filters, count):
    return count, item_list
