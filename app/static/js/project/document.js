import {datatable_reload_table, datatables_init} from "../datatables/dt.js";
import {fetch_delete, fetch_get} from "../common/common.js";

const   meta = await fetch_get("document.meta");

const __document_delete = async (ids) => {
    bootbox.confirm("Wilt u dit/deze document(en) verwijderen?", async result => {
        if (result) {
            await fetch_delete("document.document", {ids})
            datatable_reload_table();
        }
    });
}
const context_menu_items = [
    {type: "item", label: 'Document(en) verwijderen', iconscout: 'trash-alt', cb: __document_delete},
]

const filter_menu_items = [
    {
        type: 'select',
        id: 'school-select',
        label: 'Deelschool',
        options: [{value: "all", label: "Alle"}].concat(meta.schools.map(s => ({value: s, label: s.toUpperCase()}))),
        default: 'all',
        persistent: true
    }
]

$(document).ready(async function () {
    datatables_init({filter_menu_items, context_menu_items});
});
