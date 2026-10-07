import {dayPartField, bindDayPartField, sameDayDates, selectedDayPart, dayPartLabel} from "../../common/day_part.js";
import {fetch_get, fetch_post, fetch_update, fetch_delete} from "../../common/common.js";
import {ResizeImage} from "./image.js";
import {AlertPopup} from "../../common/popup.js";

$(document).ready(async function () {
    const document_list = document.getElementById("document-list");
    const student_div = document.getElementById("student-div");
    const new_medischattest_btn = document.getElementById("new-medischattest-btn");
    const new_loattest_btn = document.getElementById("new-loattest-btn");
    const new_ouderattest_btn = document.getElementById("new-ouderattest-btn");
    const document_field = document.getElementById("document-field");
    const staff_attest_type = document.getElementById("staff-attest-type");
    const staff_attest_btn = document.getElementById("staff-attest-btn");
    // if present, username is an argument in the url
    const username = new URLSearchParams(window.location.search).get("username");
    const meta = await fetch_get("document.meta");
    if (!meta) {
        new_medischattest_btn.hidden = true;
        return;
    }
    // Staff member accesses the page
    if (meta.staff) {
        const selected = username ? await fetch_get("document.student", {username}) : null;
        meta.student = selected?.student || null;
        meta.documents = selected?.documents || [];
        document.getElementById("student-picker").hidden = false;
        const list = document.getElementById("student-list");
        const search = document.getElementById("student-search");
        const clear = document.getElementById("student-clear");
        search.value = meta.student ? `${meta.student.naam} ${meta.student.voornaam}` : "";
        list.hidden = !!meta.student; // hide the list if a student is selected
        const filter_students = () => {
            // create a list of students, filtered on the content of the textbox
            const query = search.value.trim().toLocaleLowerCase();
            const students = meta.students.filter(student => student.label.toLocaleLowerCase().includes(query));
            list.innerHTML = "";
            for (const student of students) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "student-choice";
                button.textContent = student.label;
                // if a student is clicked, reload the page with the username as argument
                button.addEventListener("click", () => {
                    search.value = student.label;
                    const url = new URL(window.location.href);
                    url.searchParams.set("username", student.username);
                    window.location.assign(url.href);
                });
                list.appendChild(button);
            }
            if (!students.length) {
                list.textContent = "Geen leerlingen gevonden";
            }
        };
        // clear-student button is clicked
        const restart_selection = () => {
            staff_attest_type.hidden = true;
            staff_attest_btn.hidden = true;
            meta.student = null;
            document_list.hidden = true;
            new_medischattest_btn.hidden = true;
            new_loattest_btn.hidden = true;
            student_div.textContent = "Selecteer eerst een leerling.";
            list.hidden = false;
            const url = new URL(window.location.href);
            url.searchParams.delete("username");
            window.history.replaceState(null, "", url.href);
            filter_students();
        };
        search.addEventListener("input", restart_selection);
        clear.addEventListener("click", () => {
            search.value = "";
            restart_selection();
            search.focus();
        });
        filter_students();
        if (!meta.student) {
            new_medischattest_btn.hidden = true;
            student_div.textContent = "Selecteer eerst een leerling.";
            return;
        }
        student_div.textContent = `Leerling: ${meta.student.naam} ${meta.student.voornaam} (${meta.student.klasgroep})`;
    } else {
        student_div.textContent = `Leerling: ${meta.current_user.student}`;
    }
    let medical_day_part = "whole_day";
    let upload_document_type = "medischattest";
    let upload_document_label = "medisch attest";
    const ctx = {ouderattest: {attests: [], nbr_attests: 0, updated: false}}; // Cache to hold all the ouderattests

    // Render all attests consistently and refresh the ouderattest validation cache.
    const __render_attests = () => {
        document_list.replaceChildren();
        for (const doc of meta.documents) {
            const div = document.createElement("div");
            const label = meta.document_type_labels[doc.document_type] || doc.document_type;
            div.textContent = `${doc.from_day} ${label}${dayPartLabel(doc)}`;
            if (doc.document_type === "ouderattest") div.textContent += `, ${doc.nbr_days} dag(en)`;
            div.dataset.id = doc.id;
            document_list.appendChild(div);
        }
        ctx.ouderattest.attests = meta.documents.filter(doc => doc.document_type === "ouderattest");
        ctx.ouderattest.nbr_attests = ctx.ouderattest.attests.length;
    };

    const __handle_add_response = resp => {
        if (!resp?.document) return;
        const index = meta.documents.findIndex(doc => String(doc.id) === String(resp.document.id));
        if (index === -1) meta.documents.unshift(resp.document);
        else meta.documents[index] = resp.document;
        __render_attests();
    };

    const __handle_update_ouderattest_response = resp => {
        if (resp?.document && ctx.ouderattest.updated) {
            __handle_add_response(resp);
            ctx.ouderattest.updated = false;
        }
    };

    const __show_attest = async event => {
        const div = event.target.closest("div");
        const documents = await fetch_get("document.document", {filters: `id$=$${div.dataset.id}`});
        if (documents.length > 0) {
            const data = documents[0];
            if (data.file_type.includes("image")) {
                const base64_image = `data:${data.file_type};base64, ` + data.file;
                const new_tab = window.open();
                if (new_tab) {
                    new_tab.document.title = data.name;
                    const image = new_tab.document.createElement("img");
                    image.src = base64_image;
                    image.alt = "Base64 Image";
                    new_tab.document.body.replaceChildren(image);
                } else {
                    alert("Popup blocked! Please allow popups for this site.");
                }
            } else if (data.file_type.includes("video")) {
                const new_tab = window.open();
                if (new_tab) {
                    new_tab.document.title = data.name;
                    new_tab.document.body.style.cssText = "margin:0; display:flex; justify-content:center; align-items:center; height:100vh; background-color:#000;";
                    const video = new_tab.document.createElement("video");
                    video.controls = true;
                    video.autoplay = true;
                    video.style.cssText = "max-width:100%; max-height:100vh;";
                    const source = new_tab.document.createElement("source");
                    source.src = `data:${data.file_type};base64,${data.file}`;
                    source.type = data.file_type;
                    video.appendChild(source);
                    video.appendChild(new_tab.document.createTextNode("Your browser does not support the video tag."));
                    new_tab.document.body.replaceChildren(video);
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
            __set_document_field_file(new File([result.value], `${upload_document_type}-${Date.now()}.jpg`, {type: result.value.type}));
        }
    }

    document_field.addEventListener("change", async e => {
        if (!e.target.files.length || (meta.staff && !meta.student)) return;
        const patience = Swal.fire({html: `Even geduld, het ${upload_document_label} wordt bewaard`, showConfirmButton: false});
        const data = new FormData();
        data.append("from_day", from_day_value);
        data.append("nbr_days", new_nbr_of_days);
        data.append("day_part", medical_day_part);
        data.append("document_type", upload_document_type);
        data.append("username", meta.staff ? meta.student.username : meta.current_user.username)
        data.append("coaccount_nbr", meta.staff ? 5 : meta.current_user.coaccount_nbr);
        data.append("document_scan", true);
        const resized_blob = await new ResizeImage({max_bytes: 100_000}).process(e.target.files[0]);
        const resized_image = new File([resized_blob], e.target.files[0].name, {type: resized_blob.type, lastModified: Date.now()})
        data.append("attachment_file", resized_image);
        const resp = await fetch_post("document.document", data, true);
        patience.close();
        document_field.value = null;
        __handle_add_response(resp);
    });

    const __new_scan_attest = async (document_type, label) => {
        if (meta.staff && !meta.student) return;
        upload_document_type = document_type;
        upload_document_label = label;
        const now = new Date()

        const validate_attest_dates = () => {
            from_day_value = document.getElementById("absent-from-day").value;
            const from_day = new Date(from_day_value);
            const till_day_date_select = document.getElementById("absent-till-day");
            const till_day_value = till_day_date_select.value;
            if (!from_day_value || !till_day_value || Number.isNaN(from_day.getTime())) {
                Swal.showValidationMessage("Kies een begindatum en een einddatum.");
                return false;
            }
            const till_day = new Date(till_day_value);
            if (till_day < from_day) {
                Swal.showValidationMessage("De einddatum moet op of na de begindatum liggen.");
                return false
            }
            new_nbr_of_days = (till_day - from_day) / (1000 * 60 * 60 * 24) + 1;
            medical_day_part = selectedDayPart(new_nbr_of_days);
            return true
        }

        const result = await Swal.fire({
            title: `Nieuw ${label}`,
            html: `
                <div style="text-align:left;">
                    Datum: ${now.toLocaleDateString("nl-NL", {weekday: "long", year: "numeric", month: "long", day: "numeric"})}<br>
                    ${meta.staff ? "Attest geldig vanaf:" : document_type === "loattest" ? "Vrijgesteld van de les lichamelijke opvoeding vanaf:" : "Was afwezig vanwege ziekte vanaf:"} <input type="date" id="absent-from-day"><br>
                    t.e.m.: <input type="date" id="absent-till-day"><br>
                    ${dayPartField}
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
            preConfirm: validate_attest_dates,
            preDeny: validate_attest_dates,
            didRender: () => {
                const today = new Date().toISOString().split("T")[0];
                document.getElementById("absent-from-day").value = today;
                bindDayPartField(sameDayDates);
            }
        });
        if (result.isConfirmed) {
            const result = await Swal.fire({
                title: `Nieuw ${label}`,
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
    // Dates may arrive in any order. Reject overlaps and check contiguous whole-day
    // periods on both sides; extend an adjacent attest only within the three-day limit.
    // Ouderattest for Friday -> Saturday and Sunday assumed -> is 3 consecutive days.  Monday medical attest (if still absent)
    // Ouderattest for Thursday and Friday -> Saturday assumed -> is 3 consecutive days.
    const __new_ouderattest = async () => {
        if (ctx.ouderattest.nbr_attests >= OUDERATTEST_MAX_NBR) {
            await Swal.fire({
                icon: "warning",
                text: `Sorry, u mag maximaal ${OUDERATTEST_MAX_NBR} ouderattesten insturen!`,
                confirmButtonText: "Ok",
                showConfirmButton: true,
                showCloseButton: false,
                showCancelButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
                timer: undefined,
            });
            return;
        }
        const now = new Date()
        let nbr_of_days = 0;
        let day_part = "whole_day";
        ctx.ouderattest.updated = false;
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
                    ${dayPartField}
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
                    if (nbr > OUDERATTEST_CONSECUTIVE) {
                        Swal.fire(`Sorry, de leerling mag maximaal ${OUDERATTEST_CONSECUTIVE} dagen aaneensluitend afwezig zijn!`)
                        return [false, nbr]
                    }
                    if (day_part !== "whole_day") return [true, nbr];
                    const day_of_week = date.getUTCDay(); // 0 is Sunday
                    if (day_of_week === 4 && nbr >= 2) return [true, OUDERATTEST_CONSECUTIVE] //th, fr -> add sa
                    if (day_of_week === 5 && nbr >= 1) return [true, OUDERATTEST_CONSECUTIVE] //fr -> add sa, su
                    return [true, nbr]
                }

                // Validate the complete interval, including weekend days added above.
                const __check_attests = (from_date, nbr_days) => {
                    const day_ms = 1000 * 60 * 60 * 24;
                    const start = from_date.getTime() / day_ms;
                    const end = start + nbr_days - 1;
                    const intervals = ctx.ouderattest.attests.map(doc => ({
                        doc, start: new Date(doc.from_day).getTime() / day_ms,
                        end: new Date(doc.from_day).getTime() / day_ms + Number(doc.nbr_days) - 1
                    }));
                    // Reject any overlap with an existing attest
                    if (intervals.some(item => start <= item.end && end >= item.start)) {
                        Swal.fire('Sorry, u heeft al een attest voor deze dag(en) ingediend');
                        return false;
                    }
                    // if nbr of days is 1, then day_part can be am or pm.  In this case, 2 attests are required for 2 consecutive days with day_part, e.g. am
                    if (day_part !== "whole_day") return true;
                    // filter out intervals with partial days (am or pm)
                    const whole_days = intervals.filter(item => (item.doc.day_part || "whole_day") === "whole_day");
                    // Sort the new interval and existing attests into connected periods.
                    // periods is an array of objects with start and end day, and an array of attests.
                    // if intervals can be combined, the existing object is adapted (end day) and its attest is also pushed in the array of attests
                    const periods = [];
                    // [...whole_days, {..}].sort(...) creates a sorted array (on start), including the new attest (with a dummy document)
                    for (const item of [...whole_days, {start, end, doc: null}].sort((a, b) => a.start - b.start)) {
                        const previous = periods[periods.length - 1]; //pick the latest or null
                        if (previous && item.start <= previous.end + 1) {
                            previous.end = Math.max(previous.end, item.end);
                            previous.items.push(item);
                        } else {
                            periods.push({start: item.start, end: item.end, items: [item]});
                        }
                    }
                    // Find the period with the dummy document (new attest) and check if it exceeds the maximum nbr of days
                    const period = periods.find(period => period.items.some(item => item.doc === null));
                    if (period.end - period.start + 1 > OUDERATTEST_CONSECUTIVE) {
                        Swal.fire(`Sorry, de leerling mag maximaal ${OUDERATTEST_CONSECUTIVE} dagen aaneensluitend afwezig zijn!`);
                        return false;
                    }
                    const connected = period.items.filter(item => item.doc !== null);
                    if (connected.length) {
                        // The new attest bridges (two) or expands (one) existing attest(s)
                        // Keep the earliest attest and remove all others after updating it.
                        ctx.ouderattest.updated = true;
                        ctx.ouderattest.id = connected[0].doc.id;
                        ctx.ouderattest.from_day = new Date(period.start * day_ms).toISOString().split("T")[0];
                        ctx.ouderattest.nbr_days = period.end - period.start + 1;
                        ctx.ouderattest.obsolete_ids = connected.slice(1).map(item => item.doc.id);
                    }
                    return true;
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
                if (!Number.isFinite(from_day.getTime())) {
                    Swal.fire("Vul een geldige begindatum in");
                    return false;
                }
                ctx.ouderattest.updated = false;
                day_part = selectedDayPart(nbr_of_days);
                // Check if the oudersattest is valid, see rules at the top
                const [ok_days, updated_nbr_of_days] = __check_nbr_days(from_day, nbr_of_days)
                if (!ok_days) return false // error, try again
                nbr_of_days = updated_nbr_of_days;
                return __check_attests(from_day, nbr_of_days);
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
                bindDayPartField(() => document.getElementById("nbr-days-select").value === "one-day" ||
                    (document.getElementById("nbr-days-select").value === "more-days" && sameDayDates()));
                document.getElementById("absent-on-day").value = today;
                document.getElementById("absent-from-day").value = today;
            }
        });
        if (result.isConfirmed) {
            if (ctx.ouderattest.updated) {
                const patience = Swal.fire({html: "Even geduld, het ouderattest wordt aangepast", showConfirmButton: false});
                const resp = await fetch_update("document.document", {id: ctx.ouderattest.id, from_day: ctx.ouderattest.from_day, nbr_days: ctx.ouderattest.nbr_days})
                patience.close();
                __handle_update_ouderattest_response(resp);
                // Never remove an existing attest unless the merged document was saved.
                if (resp?.document && ctx.ouderattest.obsolete_ids.length) {
                    // delete obsolete attests and update ctx.ouderattest accordingly
                    const deleted = await fetch_delete("document.document", {ids: ctx.ouderattest.obsolete_ids.join(",")});
                    // Status-only responses become null in the shared fetch helper.
                    // Confirm absence before removing a row when no IDs were returned.
                    let deleted_ids = deleted?.deleted_ids;
                    if (!Array.isArray(deleted_ids) || deleted_ids.length === 0) {
                        deleted_ids = [];
                        for (const id of ctx.ouderattest.obsolete_ids) {
                            const remaining = await fetch_get("document.document", {filters: `id$=$${id}`});
                            if (Array.isArray(remaining) && remaining.length === 0) deleted_ids.push(id);
                        }
                    }
                    if (deleted_ids.length) {
                        const ids = new Set(deleted_ids.map(String));
                        meta.documents = meta.documents.filter(doc => !ids.has(String(doc.id)));
                        __render_attests();
                    }
                }
            } else {
                if (ctx.ouderattest.nbr_attests == (OUDERATTEST_MAX_NBR - 1)) {
                    const warning = await Swal.fire({
                        icon: "warning",
                        html: `${OUDERATTEST_MAX_NBR}de ouderattest.<br>Voortaan bij elke afwezigheid doktersattest vereist.`,
                        confirmButtonText: "Ok",
                        showConfirmButton: true,
                        showCloseButton: false,
                        showCancelButton: false,
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        timer: undefined,
                    });
                    if (!warning.isConfirmed) return;
                }
                const patience = Swal.fire({html: "Even geduld, het ouderattest wordt bewaard", showConfirmButton: false});
                const data = new FormData();
                data.append("from_day", from_day_value);
                data.append("nbr_days", nbr_of_days);
                data.append("day_part", day_part);
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

    // Show already uploaded documents for the current school year.
    __render_attests();

    // When clicked on a document in the list, show the content
    document_list.addEventListener("click", async event => __show_attest(event));

    new_medischattest_btn.addEventListener("click", async () => __new_scan_attest("medischattest", "medisch attest"));
    if (meta.staff) {
        new_medischattest_btn.hidden = true;
        for (const [type, label] of Object.entries(meta.document_type_labels)) {
            const option = document.createElement("option");
            option.value = type;
            option.textContent = label;
            staff_attest_type.appendChild(option);
        }
        staff_attest_type.value = Object.hasOwn(meta.document_type_labels, "medischattest") ? "medischattest" : Object.keys(meta.document_type_labels)[0];
        staff_attest_type.hidden = false;
        staff_attest_btn.hidden = false;
        staff_attest_btn.addEventListener("click", async () => {
            const type = staff_attest_type.value;
            if (Object.hasOwn(meta.document_type_labels, type)) {
                await __new_scan_attest(type, meta.document_type_labels[type]);
            }
        });
    }
    if (meta.current_user.coaccount_nbr > 0 && meta.current_user.coaccount_nbr < 5) {
        new_loattest_btn.hidden = false;
        new_loattest_btn.addEventListener("click", async () => __new_scan_attest("loattest", "LO-attest"));
        new_ouderattest_btn.hidden = false;
        new_ouderattest_btn.addEventListener("click", async () => __new_ouderattest());
        student_div.innerHTML += `<br>Ouder: ${meta.current_user.coaccount_name}`

    }
});
