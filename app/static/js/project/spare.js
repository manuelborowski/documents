import {datatables_init, datatable_row_data_from_id, datatable_reload_table} from "../datatables/dt.js";
import {AlertPopup} from "../common/popup.js";
import {fetch_update, fetch_post, fetch_get} from "../common/common.js";
import {badge_raw2hex} from "../common/rfid.js";


const __dialog_new_single_spare = async (default_id = null, default_auto_increment = false) => {
    const form = await fetch_get("spare.form")
    if (form) {
        var new_spare = false;
        bootbox.dialog({
            title: "Nieuwe reserve laptop badge (* is vereist)",
            message: form.template,
            buttons: {
                confirm: {
                    label: 'Ok',
                    className: 'btn-primary',
                    callback: async () => {
                        const form_data = new FormData(document.getElementById("spare-form"));
                        const data = Object.fromEntries(form_data)
                        const auto_increment = data.auto_increment === "on";
                        if (data.id === "" || data.rfid === "") {
                            new AlertPopup("warning", "'Badgenummer' en 'Rfid' moeten ingevuld zijn.")
                        } else {
                            data.id = parseInt(data.id);
                            if (isNaN(data.id)) {
                                new AlertPopup("warning", "Het veld 'Badgenummer' moet een getal zijn.")
                            } else {
                                let resp = null;
                                resp = await fetch_post("spare.spare", data);
                                datatable_reload_table();
                                if (resp !== null && auto_increment) {
                                    data.id += 1;
                                    await __dialog_new_single_spare(data.id, auto_increment);
                                }
                            }
                        }
                    }
                },
                cancel: {
                    label: 'Annuleer',
                    className: 'btn-secondary'
                }
            },
            onShown: function () {
                const rfid_field = document.getElementById('rfid-field');
                rfid_field.focus();
                rfid_field.addEventListener('keypress', function (event) {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        const [valid_code, code] = badge_raw2hex(rfid_field.value);
                        if (valid_code) {
                            rfid_field.value = code;
                            document.querySelector('.bootbox .btn-primary').click(); // Trigger the Submit button
                        }
                    }
                });
                setTimeout(() => {
                    document.getElementById('auto-increment-id').checked = default_auto_increment;
                    if (default_id) {
                        const id_field = document.getElementById('id-field');
                        id_field.value = default_id;
                        id_field.dispatchEvent(new Event("input"));
                    }
                }, 100);
                document.getElementById('rfid-field').value = "";
            }
        });
    }
}

const __parse_line = line => {
    let data = {};
    var [id, label, home, serial] = line.split(";");
    if (id !== "") {
        data.id = id;
        if (label !== "") data.label = label;
        if (home !== "") data.location = home;
        if (serial !== "") data.serial = serial
    }
    return data
}

const __dialog_update_list = () => {
    const popup = bootbox.dialog({
        title: "Aanpassen van reservelaptops",
        message: `
        <form>
            <div class="form-row">
                <div class="form-element" >
                    <label for="list-field">
                    velden gescheiden door <b>;</b> (puntkomma) <br>
                    <b>Velden:</b> badgenummer;laptop-label;thuislocatie;serienummer<br>
                    thuislocatie: moet <b>baliesum</b> of <b>baliebb</b> zijn.<br>                    
                    Laat een veld leeg als het niet moet worden aangepast.<br>
                    Bv:<br> 
                    <b>23;;baliesum;</b><br>
                    <b>21;R22-45 [SPB2022-12345];;ABCDE</b><br>
                    Laptop 23 krijgt baliesum als thuislocatie.<br>
                    Laptop 21 krijgt R22-45 [SPB2022-12345] als label en ABCDE als serienummer. 
                    </label>
                    <textarea id="list-field" style="padding: 2px;flex: 1;" rows="30" cols="80"></textarea>
                </div>
            </div>
        </form> `,
        buttons: {
            confirm: {
                label: 'Ok',
                className: 'btn-primary',
                callback: async () => {
                    const list_text = document.getElementById("list-field").value;
                    const list = list_text.split("\n");
                    for (let line of list) {
                        line = line.trim();
                        if (line === "") continue;
                        const data = __parse_line(line);
                        if (data !== {}) await fetch_update("spare.spare", data)
                    }
                    datatable_reload_table();
                }
            },
            cancel: {
                label: 'Annuleer',
                className: 'btn-secondary'
            }
        },
        onShown: function () {
        }
    });
    popup[0].children[0].style.maxWidth="692px"
}

const button_menu_items = [
    {
        type: 'button',
        id: 'spare-new-single',
        label: 'Eén toevoegen',
        cb: () => __dialog_new_single_spare()
    },
    {
        type: 'button',
        id: 'spare-label-list',
        label: 'Wijzigen',
        cb: () => __dialog_update_list()
    },
]

$(document).ready(function () {
    datatables_init({button_menu_items});
});
