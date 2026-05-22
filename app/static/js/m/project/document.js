import {fetch_get, fetch_post, fetch_update} from "../../common/common.js";
import {ResizeImage} from "./image.js";
import {AlertPopup} from "../../common/popup.js";

$(document).ready(async function () {
    const document_list = document.getElementById("document-list");
    const student_div = document.getElementById("student-div");
    const new_medischattest_btn = document.getElementById("new-medischattest-btn");
    const new_ouderattest_btn = document.getElementById("new-ouderattest-btn");
    const document_field = document.getElementById("document-field");
    const meta = await fetch_get("document.meta");
    student_div.innerHTML = `Leerling: ${meta.current_user.student}`
    const ctx = {
        ouderattest: // keep track of the previous, latest auderattest, if present
            {
                nbr_attests: 0,
                nbr_days: 0,
                latest_date: new Date("2000-01-01"),
                id: -1,
                updated: false
            }
    };

    // An ouderattest was updated (nbr of days)
    const __handle_update_ouderattest_response = resp => {
        if (resp.document && ctx.ouderattest.updated) {
            const attest_div = document.querySelector(`div[data-id="${resp.document.id}"]`);
            attest_div.innerHTML = `${resp.document.from_day} ${resp.document.document_type} (${resp.document.nbr_days} dagen)`;
            ctx.ouderattest.updated = false;
            ctx.ouderattest.latest_date = new Date(resp.document.from_day);
            ctx.ouderattest.latest_date.setDate(ctx.ouderattest.latest_date.getDate() + resp.document.nbr_days - 1);
        }
    }

    const __handle_add_response = resp => {
        if (resp.document) {
            const div = document.createElement("div");
            div.innerHTML = `${resp.document.from_day} ${resp.document.document_type}`;
            div.dataset.id = resp.document.id;
            document_list.insertBefore(div, document_list.firstChild);
            if (resp.document.document_type === "ouderattest") {
                div.innerHTML += ` (${resp.document.nbr_days} dagen)`
                ctx.ouderattest.nbr_days = resp.document.nbr_days;
                ctx.ouderattest.nbr_attests++;
                ctx.ouderattest.id = resp.document.id;
                ctx.ouderattest.latest_date = new Date(resp.document.from_day);
                ctx.ouderattest.latest_date.setDate(ctx.ouderattest.latest_date.getDate() + resp.document.nbr_days - 1);
            }
        }
    }

    const __show_attest = async event => {
        const div = event.target.closest("div");
        const documents = await fetch_get("document.document", {filters: `id$=$${div.dataset.id}`});
        if (documents.length > 0) {
            const data = documents[0];
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
                downloadLink.download = `${data.naam_voornaam} ${data.klasgroep} ${data.timestamp}`;
                downloadLink.click();
            }
        }
    }

    // should be called only once, else duplicate attests are saved when more than one attest is saved.
    let new_nbr_of_days = 0;
    let from_day_value = null;
    const __set_document_field_file = file => {
        const data_transfer = new DataTransfer();
        data_transfer.items.add(file);
        document_field.files = data_transfer.files;
        document_field.dispatchEvent(new Event("change", {bubbles: true}));
    }

    // Native Android file picker allows to use the camera and to pick a file.  However, when using the camera, the file-input-html-element is not triggered (no change event) and no file is generated
    // So, use browser and video-html-element to stream the camera and take a snapshot.  This blob is converted to a file and fed to the file-input-html-element
    const __open_camera = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            await Swal.fire("Camera niet beschikbaar", "Gebruik Foto kiezen of open deze pagina via HTTPS.", "warning");
            return;
        }
        let stream = null;
        let zoom_track = null;
        let zoom_min = 1;
        let zoom_max = 1;
        let zoom_step = 0.1;
        let zoom_value = 1;
        let pinch_start_distance = null;
        let pinch_start_zoom = null;
        const touch_distance = touches => Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
        const set_zoom = async zoom => {
            if (!zoom_track) return;
            zoom_value = Math.min(zoom_max, Math.max(zoom_min, zoom));
            zoom_value = Math.round(zoom_value / zoom_step) * zoom_step;
            try {
                await zoom_track.applyConstraints({advanced: [{zoom: zoom_value}]});
            } catch (error) {
                console.warn(error);
            }
        }
        const result = await Swal.fire({
            title: "Neem een foto",
            html: `
                <style>
                    .camera-swal-popup {width:100vw !important;height:100vh !important;height:100dvh !important;padding:.25rem !important;}
                    .camera-swal-popup .swal2-html-container {height:calc(100vh - 9rem);height:calc(100dvh - 9rem);margin:.25rem 0 0 !important;overflow:hidden !important;}
                    .camera-swal-popup .swal2-title {padding:.25rem 1rem 0 !important;}
                    .camera-swal-popup .swal2-actions {margin:.5rem auto 0 !important;}
                </style>
                <div style="height:100%;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden;touch-action:none;">
                    <video id="camera-preview" autoplay playsinline style="width:100%;height:100%;object-fit:contain;background:#000;touch-action:none;"></video>
                </div>
            `,
            grow: "fullscreen",
            width: "100vw",
            showCloseButton: true,
            showCancelButton: true,
            focusConfirm: false,
            customClass: {
                popup: "camera-swal-popup"
            },
            confirmButtonText: "Foto nemen",
            confirmButtonAriaLabel: "Foto nemen",
            cancelButtonText: "Annuleer",
            cancelButtonAriaLabel: "Annuleer",
            didOpen: async () => {
                const video = document.getElementById("camera-preview");
                try {
                    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: "environment"}}});
                    video.srcObject = stream;
                    zoom_track = stream.getVideoTracks()[0];
                    const capabilities = zoom_track.getCapabilities ? zoom_track.getCapabilities() : {};
                    if (capabilities.zoom) {
                        const settings = zoom_track.getSettings();
                        zoom_min = capabilities.zoom.min;
                        zoom_max = capabilities.zoom.max;
                        zoom_step = capabilities.zoom.step || zoom_step;
                        zoom_value = settings.zoom || zoom_min;
                        video.addEventListener("touchstart", e => {
                            if (e.touches.length !== 2) return;
                            e.preventDefault();
                            pinch_start_distance = touch_distance(e.touches);
                            pinch_start_zoom = zoom_value;
                        }, {passive: false});
                        video.addEventListener("touchmove", e => {
                            if (e.touches.length !== 2 || !pinch_start_distance) return;
                            e.preventDefault();
                            set_zoom(pinch_start_zoom * (touch_distance(e.touches) / pinch_start_distance));
                        }, {passive: false});
                        const reset_pinch = () => {
                            pinch_start_distance = null;
                            pinch_start_zoom = null;
                        }
                        video.addEventListener("touchend", reset_pinch);
                        video.addEventListener("touchcancel", reset_pinch);
                    }
                } catch (error) {
                    Swal.close();
                    await Swal.fire("Camera niet beschikbaar", "Gebruik Foto kiezen of geef toestemming om de camera te gebruiken.", "warning");
                }
            },
            preConfirm: async () => {
                const video = document.getElementById("camera-preview");
                if (!video.videoWidth || !video.videoHeight) {
                    Swal.showValidationMessage("De camera is nog niet klaar. Probeer opnieuw.");
                    return false;
                }
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext("2d").drawImage(video, 0, 0);
                return await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
            },
            willClose: () => {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
            }
        });
        if (result.isConfirmed && result.value) {
            __set_document_field_file(new File([result.value], `medisch-attest-${Date.now()}.jpg`, {type: result.value.type}));
        }
    }

    document_field.addEventListener("change", async e => {
        if (!e.target.files.length) return;
        const patience = Swal.fire({html: "Even geduld, het medisch attest wordt bewaard", showConfirmButton: false});
        const data = new FormData();
        data.append("from_day", from_day_value);
        data.append("nbr_days", new_nbr_of_days);
        data.append("document_type", "medischattest");
        data.append("username", meta.current_user.username)
        data.append("coaccount_nbr", meta.current_user.coaccount_nbr);
        data.append("document_scan", true);
        const resized_blob = await new ResizeImage({max_bytes: 100_000}).process(e.target.files[0]);
        const resized_image = new File([resized_blob], e.target.files[0].name, {type: resized_blob.type, lastModified: Date.now()})
        data.append("attachment_file", resized_image);
        const resp = await fetch_post("document.document", data, true);
        patience.close();
        document_field.value = null;
        __handle_add_response(resp);
    });

    const __new_medisch_attest = async () => {
        const now = new Date()

        const validate_medisch_attest_dates = () => {
            from_day_value = document.getElementById("absent-from-day").value;
            const from_day = new Date(from_day_value);
            const till_day_date_select = document.getElementById("absent-till-day");
            const till_day_value = till_day_date_select.value;
            if (till_day_value === "") {
                till_day_date_select.style.borderColor = "red";
                till_day_date_select.style.borderWidth = "thick";
                return false
            }
            const till_day = new Date(till_day_value);
            if (till_day < from_day) {
                Swal.fire("Sorry, maar de eerste datum moet <b>voor</b> de tweede datum")
                return false
            }
            new_nbr_of_days = (till_day - from_day) / (1000 * 60 * 60 * 24) + 1;
            return true
        }

        const result = await Swal.fire({
            title: "Nieuw medisch attest",
            html: `
                <div style="text-align:left;">
                    Datum: ${now.toLocaleDateString("nl-NL", {weekday: "long", year: "numeric", month: "long", day: "numeric"})}<br>
                    Was afwezig vanwege ziekte vanaf: <input type="date" id="absent-from-day", value=${now}><br>
                    t.e.m.: <input type="date" id="absent-till-day"><br>
                </div> `,
            showCloseButton: true,
            showCancelButton: true,
            showDenyButton: true,
            focusConfirm: false,
            confirmButtonText: "Camera",
            confirmButtonAriaLabel: "Camera",
            denyButtonText: "Foto kiezen",
            denyButtonAriaLabel: "Foto kiezen",
            cancelButtonText: `Annuleer `,
            cancelButtonAriaLabel: "Annuleer",
            preConfirm: validate_medisch_attest_dates,
            preDeny: validate_medisch_attest_dates,
            didRender: () => {
                const today = new Date().toISOString().split("T")[0];
                document.getElementById("absent-from-day").value = today;
            }
        });
        if (result.isConfirmed) {
            const result = await Swal.fire({
                title: "Nieuw medisch attest",
                html: `
                <div>
                    <img src="static/img/take-picture-of-document.png" width=150px><br>
                    Leg het document plat en gebruik eventueel plakband of een gewicht.<br>
                    Zorg voor een goede belichting.<br>
                    Op de smartphone moet het hele document zichtbaar zijn.<br>
                    Houd het toestel recht boven het document.
                </div>
                  `,
                showCloseButton: true,
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: `Ok`,
                confirmButtonAriaLabel: "Ok",
                cancelButtonText: `Annuleer `,
                cancelButtonAriaLabel: "Annuleer",
            });
            if (result.isConfirmed) {
                await __open_camera();
            }
        } else if (result.isDenied) {
            document_field.value = "";
            document_field.click();
        }
    }

    const OUDERATTEST_MAX_NBR = 4;      // max 4 per schoolyear
    const OUDERATTEST_CONSECUTIVE = 3;  // max 3 consecutive days absent

    // Ouderattest, 4 per schoolyear, max 3 consecutive days per attest
    // After 3 days, medical attest required
    // New ouderattest can be concatenated to previous, given max 3 consecutive days
    // Ouderattest for Friday -> Saturday and Sunday assumed -> is 3 consecutive days
    // Ouderattest for Thursday and Friday -> Saturday assumed -> is 3 consecutive days
    const __new_ouderattest = async () => {
        const now = new Date()
        let nbr_of_days = 0;
        let from_day_value = null;
        let from_day = null;
        const result = await Swal.fire({
            title: "Nieuw ouderattest",
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

                // return [ok, nbr_days]
                const __check_nbr_days = (date, nbr) => {
                    if ((ctx.ouderattest.nbr_attests) >= OUDERATTEST_MAX_NBR) {
                        Swal.fire(`Sorry, u mag maximaal ${OUDERATTEST_MAX_NBR} ouderattesten insturen!`);
                        return [false, nbr]
                    }
                    if (nbr > OUDERATTEST_CONSECUTIVE) {
                        Swal.fire(`Sorry, de leerling mag maximaal ${OUDERATTEST_CONSECUTIVE} dagen aaneensluitend afwezig zijn!`)
                        return [false, nbr]
                    }
                    const day_of_week = date.getDay(); // 0 is Sunday
                    if (day_of_week === 4 && nbr >= 2) return [true, OUDERATTEST_CONSECUTIVE] //th, fr -> add sa
                    if (day_of_week === 5 && nbr >= 1) return [true, OUDERATTEST_CONSECUTIVE] //fr -> add sa, su
                    return [true, nbr]
                }

                // return [ok, update_latest_attest]
                const __check_last_attest = (from_date, nbr_days) => {
                    if (ctx.ouderattest.nbr_attests === 0) return [true, false]
                    if (from_date <= ctx.ouderattest.latest_date) {
                        Swal.fire(`Sorry, u heeft al een attest voor deze dag(en) ingediend`)
                        return [false, false] // error
                    }
                    if ((from_date - ctx.ouderattest.latest_date) / (1000 * 60 * 60 * 24) === 1) {
                        // Date is one day after last day of previous attest, check if it is possible to update previous attest
                        const sum_nbr_days = nbr_days + ctx.ouderattest.nbr_days;
                        if (sum_nbr_days > OUDERATTEST_CONSECUTIVE) {
                            Swal.fire(`Sorry, de leerling mag maximaal ${OUDERATTEST_CONSECUTIVE} dagen aaneensluitend afwezig zijn!`)
                            return [false, false] // error
                        }
                        ctx.ouderattest.nbr_days = sum_nbr_days;
                        ctx.ouderattest.updated = true;
                        return [true, true] // update previous (latest) attest with new nbr of days
                    }
                    return [true, false] // create new attest
                }

                const nbr_days_select = document.getElementById("nbr-days-select");
                if (nbr_days_select.value === "none") {
                    nbr_days_select.style.borderColor = "red";
                    nbr_days_select.style.borderWidth = "thick";
                    return false
                }
                if (nbr_days_select.value === "one-day") {
                    from_day_value = document.getElementById("absent-on-day").value;
                    from_day = new Date(from_day_value);
                    nbr_of_days = 1;
                } else {
                    from_day_value = document.getElementById("absent-from-day").value;
                    from_day = new Date(from_day_value);
                    const till_day_date_select = document.getElementById("absent-till-day");
                    const till_day_value = till_day_date_select.value;
                    if (till_day_value === "") {
                        till_day_date_select.style.borderColor = "red";
                        till_day_date_select.style.borderWidth = "thick";
                        return false
                    }
                    const till_day = new Date(till_day_value);
                    if (till_day < from_day) {
                        Swal.fire("Sorry, maar de eerste datum moet <b>voor</b> de tweede datum")
                        return false
                    }
                    nbr_of_days = (till_day - from_day) / (1000 * 60 * 60 * 24) + 1;
                }
                // Check if the oudersattest is valid, see rules at the top
                const [ok_latest, update_previous_attest] = __check_last_attest(from_day, nbr_of_days);
                if (!ok_latest) return false // error, try again...
                if (update_previous_attest) return true // ok, check ctx.ouderattest for updated attest
                const [ok_days, updated_nbr_of_days] = __check_nbr_days(from_day, nbr_of_days)
                if (!ok_days) return false // error, try again
                nbr_of_days = updated_nbr_of_days;
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
            if (ctx.ouderattest.updated) {
                const patience = Swal.fire({html: "Even geduld, het ouderattest wordt aangepast", showConfirmButton: false});
                const resp = await fetch_update("document.document", {id: ctx.ouderattest.id, nbr_days: ctx.ouderattest.nbr_days})
                patience.close();
                __handle_update_ouderattest_response(resp);
            } else {
                const patience = Swal.fire({html: "Even geduld, het ouderattest wordt bewaard", showConfirmButton: false});
                const data = new FormData();
                data.append("from_day", from_day_value);
                data.append("nbr_days", nbr_of_days);
                data.append("document_type", "ouderattest");
                data.append("document_scan", false);
                data.append("coaccount_nbr", meta.current_user.coaccount_nbr)
                data.append("username", meta.current_user.username)
                const resp = await fetch_post("document.document", data, true);
                patience.close();
                __handle_add_response(resp);
            }
        }
    }

    // Create list with already uploaded documents (current schoolyear only)
    for (const doc of meta.documents) {
        const div = document.createElement("div");
        div.innerHTML = `${doc.from_day} ${doc.document_type}`;
        div.dataset.id = doc.id;
        document_list.appendChild(div);
        if (doc.document_type === "ouderattest") {
            div.innerHTML += `, ${doc.nbr_days} dag(en)`
            const latest_date = new Date(doc.from_day);
            latest_date.setDate(latest_date.getDate() + doc.nbr_days - 1);
            if (latest_date > ctx.ouderattest.latest_date) {
                ctx.ouderattest.latest_date = latest_date;
                ctx.ouderattest.nbr_days = doc.nbr_days;
                ctx.ouderattest.id = doc.id;
            }
            ctx.ouderattest.nbr_attests++;
        }
    }

    // When clicked on a document in the list, show the content
    document_list.addEventListener("click", async event => __show_attest(event));

    if (meta.current_user.coaccount_nbr === 0) new_ouderattest_btn.style.display = "none";
    // New ouder/medisch attest button clicked
    new_medischattest_btn.addEventListener("click", async () => __new_medisch_attest());
    new_ouderattest_btn.addEventListener("click", async () => __new_ouderattest());
});
