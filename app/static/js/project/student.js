import {datatables_init, datatable_reload_table, datatable_row_data_from_id, datatable_update_cell} from "../datatables/dt.js";
import {fetch_get, fetch_update, now_iso_string} from "../common/common.js";
import {Rfid} from "../common/rfidusb.js";
import {socketio} from "../common/socketio.js";
import {AlertPopup} from "../common/popup.js";

const meta = await fetch_get("student.meta");

$(document).ready(async function () {
    datatables_init({});
    // Even on the students page, it is possible to get status-popups
    // socketio.subscribe_to_room(meta.my_ip);
    // socketio.subscribe_on_receive("alert-popup", (type, data) => new AlertPopup("warning", data, 6000));
});
