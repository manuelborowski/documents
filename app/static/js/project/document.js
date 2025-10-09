import {datatables_init} from "../datatables/dt.js";
import {fetch_get} from "../common/common.js";
import {AlertPopup} from "../common/popup.js";
import {socketio} from "../common/socketio.js";

const   meta = await fetch_get("document.meta");

const __column_clicked_cb = async (column, row) => {
    if (column === "name") {
        const data = await fetch_get("document.document", {id: row.id});
        if (data.file_type.includes("image")) {
            const base64_image = `data:${data.file_type};base64, ` + data.file;
            const new_tab = window.open();
            if (new_tab) {
                new_tab.document.write(`<img src="${base64_image}" alt="Base64 Image">`);
                new_tab.document.write(`<title>${data.name}</title>`);
            } else {
                alert("Popup blocked! Please allow popups for this site.");
            }
        } else if (data.file_type.includes("video")) {
            const new_tab = window.open();
            if (new_tab) {
                const base64_mp4 = `data:${data.file_type};base64, ` + data.data.file;
                new_tab.document.write(`<title>${data.name}</title>`);
                new_tab.document.write(`
                                <html>
                                  <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh; background-color:#000;">
                                    <video controls autoplay style="max-width:100%; max-height:100vh;">
                                      <source src="${base64_mp4}" type="${data.file_type}">
                                      Your browser does not support the video tag.
                                    </video>
                                  </body>
                                </html>
                              `);
                new_tab.document.close();
            } else {
                alert("Popup blocked! Please allow popups for this site.");
            }
        } else if (data.file_type.includes("text")){ // default: download
            const linkSource = `data:text/plain;base64,${data.file}`;
            const downloadLink = document.createElement("a");
            downloadLink.href = linkSource;
            downloadLink.download = `${data.name}`;
            downloadLink.click();
        } else { // default: download
            const linkSource = `data:application/pdf;base64,${data.file}`;
            const downloadLink = document.createElement("a");
            downloadLink.href = linkSource;
            downloadLink.download = `${data.naam} ${data.voornaam} ${data.klasgroep} ${data.timestamp}`;
            downloadLink.click();
        }
    }
}

const filter_menu_items = [
    {
        type: 'select',
        id: 'school-select',
        label: 'Deelschool',
        options: [{value: "all", label: "Alle"}],
        default: 'all',
        persistent: true
    },
]

$(document).ready(async function () {
    filter_menu_items.forEach(i => {
        if (i.id === "school-select") {
            i.options = i.options.concat(meta.schools.map(s => ({value: s, label: s.toUpperCase()})));
        }
    });
    socketio.subscribe_on_receive("alert-popup", (type, data) => new AlertPopup("warning", data, 4000));
    datatables_init({filter_menu_items, columns_clicked: [{column: "name", cb: __column_clicked_cb}]});
});
