import {fetch_get} from "../common/common.js";

const OUDERATTEST_MAX_NBR = 4;      // max 4 per schoolyear
const OUDERATTEST_CONSECUTIVE = 3;  // max 3 consecutive days absent

$(document).ready(async function () {
        const document_list = document.getElementById("document-list");
        const student_div = document.getElementById("student-div");
        const new_document_btn = document.getElementById("new-document-btn");
        const meta = await fetch_get("document.metam");
        student_div.innerHTML = `Leerling: ${meta.current_user.first_name} ${meta.current_user.last_name}`
        const ctx = {ouderattest: {days: 0}};

        const __handle_add_response = resp => {
            if (resp.status) {
                const div = document.createElement("div");
                div.innerHTML = `${resp.document.timestamp} ${resp.document.document_type}`;
                if (resp.document.document_type === "ouderattest") div.innerHTML += ` (${resp.document.nbr_days} dagen)`
                div.dataset.id = resp.document.id;
                document_list.insertBefore(div, document_list.firstChild);
                if (resp.document.document_type === "ouderattest") ctx.ouderattest.days += resp.document.nbr_days;
            }
            Swal.fire(resp.msg);
        }

        const __show_document_content = async event => {
            const div = event.target.closest("div");
            const data = await fetch_get("document.document", {id: div.dataset.id});
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
            } else if (data.file_type.includes("text")) { // default: download
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

        const __new_document = async () => {
            let document_type = null;
            const result = await Swal.fire({
                title: "Type document?",
                html: `
                <select id="document-type-select">
                    <option value="none">Maak uw keuze</option>
                    <option value="doktersbriefje">Medisch attest</option>
                    <option value="ouderattest">Ouderattest</option>
                </select>
                <div id="doktersbriefje-info" hidden>
                    <img src="static/img/take-picture-of-document.png" width=150px><br>
                    Leg het document plat en gebruik eventueel plakband of een gewicht.<br>
                    Zorg voor een goede belichting.<br>
                    Op de smartphone moet het hele document zichtbaar zijn.<br>
                    Houd het toestel recht boven het document.
                </div>
                <div id="ouderattest-info" style="text-align: left;" hidden>
                    Een <b>medisch attest</b> is vereist voor:
                    <ol><li>Afwezigheden van meer dan 3 opeenvolgende kalenderdagen.</li>
                    Afwezigheden van meer dan 10 lesdagen: attest onmiddellijk aan de school bezorgen.
                    <li>Elke afwezigheid wegens ziekte nadat de leerling reeds vier maal afwezig was zonder medisch attest.</li>
                    <li>Elke afwezigheid tijdens de syntheseproeven of bij excursies.</li></ol><br>
                    <b>Elke afwezigheid anders dan ziekte vereist vooraf de toestemming van de directie.</b>
                    </ol>                
                    </div>
                  `,
                showCloseButton: true,
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: `Ok`,
                confirmButtonAriaLabel: "Ok",
                cancelButtonText: `Annuleer `,
                cancelButtonAriaLabel: "Annuleer",
                preConfirm: () => {
                    const document_type_select = document.getElementById("document-type-select");
                    document_type = document_type_select.value;
                    if (document_type === "none") {
                        document_type_select.style.borderColor = "red";
                        return false;
                    } else return true;
                },
                didRender: () => {
                    document.getElementById("document-type-select").addEventListener("change", e => {
                        document.getElementById("doktersbriefje-info").hidden = true;
                        document.getElementById("ouderattest-info").hidden = true;
                        if (e.target.value === "doktersbriefje") {
                            document.getElementById("doktersbriefje-info").hidden = false;
                        } else {
                            document.getElementById("ouderattest-info").hidden = false;
                        }
                    });

                }
            });
            if (result.isConfirmed) {
                const document_type_select = document.getElementById("document-type-select");
                if (document_type_select.value === "doktersbriefje") {
                    document.getElementById("document-field").click();
                    // upload attachments, called when the file select dialog closes.
                    document.getElementById("document-field").addEventListener("change", async e => {
                        const data = new FormData();
                        data.append("document_type", document_type);
                        data.append("username", meta.current_user.username)
                        data.append("attachment_file", e.target.files[0]);
                        const resp_json = await fetch(Flask.url_for("document.document"), {method: 'POST', body: data});
                        const resp = await resp_json.json()
                        __handle_add_response(resp);
                    });
                } else if (document_type_select.value === "ouderattest") {
                    __oudersattest();
                }
            }
        }

        const __oudersattest = async () => {
            const now = new Date()
            let new_nbr_of_days = 0;
            let from_day_value = null;
            let from_day = null;
            const result = await Swal.fire({
                title: "Ouderattest",
                html: `
                        <div style="text-align:left;">
                            Datum: ${now.toLocaleDateString("nl-NL", {weekday: "long", year: "numeric", month: "long", day: "numeric"})}<br>
                            Naam: ${meta.student.naam}<br>
                            Voornaam: ${meta.student.voornaam}<br>
                            Klas: ${meta.student.klasgroep}<br>
                            <select id="nbr-days-select">
                                <option value="none">Hoeveel dagen afwezig?</option>
                                <option value="one-day">Eén dag</option>
                                <option value="more-days">Twee of meer</option>
                            </select>
                            <div id="one-day-div" hidden>
                                Was afwezig vanwege ziekte op : <input type="date" id="absent-on-day"><br>
                            </div>
                            <div id="more-days-div" hidden>
                                Was afwezig vanwege ziekte vanaf: <input type="date" id="absent-from-day"><br>
                                t.e.m.: <input type="date" id="absent-till-day"><br>
                            </div>
                        </div>
                  `,
                showCloseButton: true,
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: `Ok`,
                confirmButtonAriaLabel: "Ok",
                cancelButtonText: `Annuleer `,
                cancelButtonAriaLabel: "Annuleer",
                preConfirm: () => {
                    // Check if the oudersattest is valid
                    // -Maximum 4 days per schoolyear
                    // -Maximum 3 consecutive days
                    // -Cannot span a weekend
                    if (document.getElementById("nbr-days-select").value === "one-day") {
                        from_day_value = document.getElementById("absent-on-day").value;
                        new_nbr_of_days = 1;
                    } else {
                        from_day_value = document.getElementById("absent-from-day").value;
                        const from_day = new Date(from_day_value);
                        const till_day_value = document.getElementById("absent-till-day").value;
                        const till_day = new Date(till_day_value);
                        if (till_day < from_day) {
                            Swal.fire("Sorry, maar de eerste datum moet <b>voor</b> de tweede datum")
                            return false
                        }
                        new_nbr_of_days = (till_day - from_day) / (1000 * 60 * 60 * 24) + 1;
                        if (new_nbr_of_days > OUDERATTEST_CONSECUTIVE) {
                            Swal.fire(`Sorry, de leerling mag maximaal ${OUDERATTEST_CONSECUTIVE} dagen aaneensluitend afwezig zijn!`)
                            return false
                        }
                    }
                    if ((ctx.ouderattest.days + new_nbr_of_days) > OUDERATTEST_MAX_NBR) {
                        Swal.fire(`Sorry, de leerling mag maximaal ${OUDERATTEST_MAX_NBR} dagen afwezig zijn!`);
                        return false
                    }
                    return true
                },
                didRender: () => {
                    document.getElementById("nbr-days-select").addEventListener("change", e => {
                        if (e.target.value === "one-day") {
                            document.getElementById("one-day-div").hidden = false;
                            document.getElementById("more-days-div").hidden = true;
                        } else {
                            document.getElementById("one-day-div").hidden = true;
                            document.getElementById("more-days-div").hidden = false;
                        }
                    });
                    const today = new Date().toISOString().split("T")[0];
                    document.getElementById("absent-on-day").value = today;
                    document.getElementById("absent-from-day").value = today;
                }
            });
            if (result.isConfirmed) {
                const data = new FormData();
                data.append("from_day", from_day_value);
                data.append("nbr_days", new_nbr_of_days);
                data.append("document_type", "ouderattest");
                data.append("username", meta.current_user.username)
                const resp_json = await fetch(Flask.url_for("document.document"), {method: 'POST', body: data});
                const resp = await resp_json.json()
                __handle_add_response(resp);
            }
        }
        // Create list with already uploaded documents
        for (const doc of meta.documents) {
            const div = document.createElement("div");
            div.innerHTML = `${doc.timestamp} ${doc.document_type}`;
            if (doc.document_type === "ouderattest") div.innerHTML += ` (${doc.nbr_days} dagen)`
            div.dataset.id = doc.id;
            document_list.appendChild(div);
            if (doc.document_type === "ouderattest") ctx.ouderattest.days += doc.nbr_days;
        }

        // When clicked on a document in the list, show the content
        document_list.addEventListener("click", async event => __show_document_content(event));

        // New document button clicked
        new_document_btn.addEventListener("click", async () => __new_document());


    });
