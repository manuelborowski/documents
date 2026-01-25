import {datatables_init, datatable_reload_table} from "../datatables/dt.js";
import {fetch_post, fetch_get, fetch_update, fetch_delete} from "../common/common.js";
import {BForms} from "../common/BForms.js";

$(document).ready(function () {
    datatables_init();
});
