from app import data as dl, application as al
import sys, requests
from thefuzz import process

#logging on file level
import logging
from app import MyLogFilter, top_log_handle, app
log = logging.getLogger(f"{top_log_handle}.{__name__}")
log.addFilter(MyLogFilter())

def update(data):
    try:
        ids = [d["id"] for d in data]
        persons = dl.person.get_m(("id", "in", ids))
        person_cache = {str(p.id): p for p in persons}
        for d in data:
            d["item"] = person_cache[d["id"]]
        dl.person.update_m(data)
        return {"status": "ok", "msg": "Deelnemers aangepast"}
    except Exception as e:
        log.error(f'{sys._getframe().f_code.co_name}: {data}, {e}')
        return {"status": "error", "msg": str(e)}


######################### CRON HANDLERS ##################################
def person_cron_load_from_sdh(opaque=None, **kwargs):
    log.info(f"{sys._getframe().f_code.co_name}, START")
    try:
        updated_persons = []
        nbr_updated = 0
        new_persons = []
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
                db_persons = dl.person.get_m(("klasgroep", "!", "Leerkracht"))
                db_informatnummer_to_student = {s.informatnummer: s for s in db_persons}
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
                        if update:
                            update.update({"item": db_student})
                            updated_persons.append(update)
                            log.info(f'{sys._getframe().f_code.co_name}, Update student {db_student.informatnummer}, update {update}')
                            nbr_updated += 1
                        del(db_informatnummer_to_student[sdh_student["leerlingnummer"]])
                    else:
                        new_student = {"informatnummer": sdh_student["leerlingnummer"], "klasgroep": klas2klasgroep[sdh_student["klascode"]], "instellingsnummer": sdh_student["instellingsnummer"],
                                       "roepnaam": sdh_student["roepnaam"], "naam": sdh_student["naam"], "voornaam": sdh_student["voornaam"], "rfid": sdh_student["rfid"], "geslacht": sdh_student["geslacht"]}
                        new_persons.append(new_student)
                        log.info(f'{sys._getframe().f_code.co_name}, New student {sdh_student["leerlingnummer"]}')
                deleted_persons = [v for (k, v) in db_informatnummer_to_student.items()]
                for person in deleted_persons:
                    log.info(f'{sys._getframe().f_code.co_name}, Delete student {person.informatnummer}')
                dl.person.add_m(new_persons)
                dl.person.update_m(updated_persons)
                dl.person.delete_m(objs=deleted_persons)
                log.info(f'{sys._getframe().f_code.co_name}, Students add {len(new_persons)}, update {nbr_updated}, delete {len(deleted_persons)}')
            else:
                log.info(f'{sys._getframe().f_code.co_name}, error retrieving students from SDH, {sdh_students["data"]}')
        else:
            log.error(f'{sys._getframe().f_code.co_name}: api call to {sdh_student_url} returned {res.status_code}')

        updated_persons = []
        nbr_updated = 0
        new_persons = []
        # check for new, updated or deleted staff
        sdh_staff_url = app.config["SDH_GET_STAFF_URL"]
        res = requests.get(sdh_staff_url, headers={'x-api-key': sdh_key})
        if res.status_code == 200:
            sdh_staffs = res.json()
            if sdh_staffs['status']:
                log.info(f'{sys._getframe().f_code.co_name}, retrieved {len(sdh_staffs["data"])} staffs from SDH')
                db_persons = dl.person.get_m(("klasgroep", "=", "Leerkracht"))
                db_informatnummer_to_staff = {s.informatnummer: s for s in db_persons}
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
                            updated_persons.append(update)
                            log.info(f'{sys._getframe().f_code.co_name}, Update staff {db_staff.informatnummer}, update {update}')
                            nbr_updated += 1
                        del(db_informatnummer_to_staff[sdh_staff["informat_id"]])
                    else:
                        new_staff = {"informatnummer": sdh_staff["informat_id"], "klasgroep": "Leerkracht", "roepnaam": sdh_staff["voornaam"],
                                       "naam": sdh_staff["naam"], "voornaam": sdh_staff["voornaam"], "rfid": sdh_staff["rfid"], "geslacht": sdh_staff["geslacht"]}
                        new_persons.append(new_staff)
                        log.info(f'{sys._getframe().f_code.co_name}, New staff {sdh_staff["informat_id"]}')
                deleted_persons = [v for (k, v) in db_informatnummer_to_staff.items()]
                for person in deleted_persons:
                    log.info(f'{sys._getframe().f_code.co_name}, Delete staff {person.informatnummer}')
                dl.person.add_m(new_persons)
                dl.person.update_m(updated_persons)
                dl.person.delete_m(objs=deleted_persons)
                log.info(f'{sys._getframe().f_code.co_name}, Staff add {len(new_persons)}, update {nbr_updated}, delete {len(deleted_persons)}')
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
    lists = dl.list.get_m()
    list_cache = {l.id: l for l in lists}
    for i in db_list:
        em = i.to_dict()
        em.update({"row_action": i.id, "DT_RowId": i.id, "deelschool": i.schoolcode, "jaar": i.jaar, "graad": i.graad, "lijst": list_cache[i.lijst_id].name if i.lijst_id in list_cache else "NVT"})
        out.append(em)
    return total_count, filtered_count, out

def post_sql_order(l, on, direction):
    l.sort(reverse=direction != "desc", key=lambda x: x[on])
    return l

def post_sql_filter(item_list, filters, count):
    for f in filters:
        if f['id'] in ['deelschool', "graad", "jaar", "klasgroep"]:
            if f['value'] != 'all':
                item_list = [i for i in item_list if i[f["id"]] == f["value"]]
    count = len(item_list)
    return count, item_list
