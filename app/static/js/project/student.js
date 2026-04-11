import {datatable_row_data_from_id, datatables_init} from "../datatables/dt.js";
import {fetch_get, fetch_post} from "../common/common.js";

const meta = await fetch_get("document.meta");

// Enables the webcam, display a preview and a capture and load button.
// When the capture button is pressed, a still is taken
// When the load button is pressed, an image can be uploaded
// A new popup appears to crop the still/image and send it to the server
async function __scan_attest(ids, type, label) {
    const student = datatable_row_data_from_id(ids[0]);
    const webcamHTML = `
          <div style="display:flex; flex-direction:column; gap:10px; align-items:center;">
          <div style="height: 600px;"> <video id="swal-video" autoplay playsinline style="width:100%;margin-top:100px;"> </video> </div>
          <div>
          <button id="capture-btn" class="swal2-confirm swal2-styled" style="margin-top:10px;"> Neem een foto </button>
          <button id="load-btn" class="swal2-confirm swal2-styled" style="background:#555;"> Of laad een foto </button>
          </div>
          <input type="file" id="file-input" accept="image/*" style="display:none;">
          </div> `;
    const result = await Swal.fire({
        title: `${label} voor ${student.naam} ${student.voornaam}`,
        html: webcamHTML,
        showCancelButton: false,
        showConfirmButton: false,
        heightAuto: false,
        width: "700px",
        didOpen: async () => {
            const popup = Swal.getPopup();
            const video = popup.querySelector("#swal-video");
            const capture_button = popup.querySelector("#capture-btn");
            const load_button = popup.querySelector("#load-btn");
            const file_input = popup.querySelector("#file-input");
            video.srcObject = await navigator.mediaDevices.getUserMedia({video: {width: {ideal: 1920}, height: {ideal: 1080}}}); // start camera
            video.style.transform = "rotate(90deg)";
            video.style.transformOrigin = "center center";
            video.style.objectFit = "contain";
            // capture button: generate a still from the video stream and show the cropping popup
            capture_button.addEventListener("click", async () => {
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                // For 90° rotation, swap canvas dimensions
                const canvas = document.createElement("canvas");
                canvas.width = vh;
                canvas.height = vw;
                const ctx = canvas.getContext("2d");
                // IMPORTANT: set transform BEFORE drawing
                ctx.save();
                // Move origin to the center of the rotated canvas
                ctx.translate(canvas.width / 2, canvas.height / 2);
                // Rotate coordinate system 90° clockwise
                ctx.rotate(Math.PI / 2);
                // Draw the video centered in the rotated coordinate system
                ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
                ctx.restore();
                const base64 = canvas.toDataURL("image/jpeg");
                Swal.close();                // Close this popup
                const [ok_crop, blob] = await __crop_image(base64);
                if (!ok_crop) return false
                const [ok_date, from_day, nbr_days] = await __get_from_till_date();
                if (!ok_date) return false
                await __post_document(blob, type, from_day, nbr_days, student);
            });
            // load button: display a load-file-popup, load the file and show the cropping popup
            load_button.addEventListener("click", () => file_input.click());
            file_input.addEventListener("change", () => {
                const file = file_input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                    Swal.close();                 // Close capture popup
                    const [ok_crop, blob] = await __crop_image(reader.result);
                    if (!ok_crop) return false
                    const [ok_date, from_day, nbr_days] = await __get_from_till_date();
                    if (!ok_date) return false
                    await __post_document(blob, type, from_day, nbr_days, student);
                };
                reader.readAsDataURL(file);
            });
        },
        didClose: () => {
            // close the camera
            const video = document.querySelector("#swal-video");
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach(t => t.stop());
            }
        }
    });
}

async function __paste_attest(ids, type, label) {
    const student = datatable_row_data_from_id(ids[0]);
    let pastedBlob = null;
    const result = await Swal.fire({
        title: `Plak een ${label} voor ${student.naam} ${student.voornaam}`,
        html: `
            <div style="text-align:left">
             Open knipprogramma<br>
             klik op nieuw/plusteken (ctrl-n)<br>
             Maak een selectie<br>
             Kopiëer de tekst (ctrl-c)<br>
             Klik hier<br>
             Plak de tekst (ctrl-v)<br>
             Klik op bewaar
             </div>  
            <div id="preview" style="margin-top:10px"></div> `,
        showCancelButton: false,
        confirmButtonText: "Bewaar",
        width: "700px",
        didOpen: () => {
            const popup = Swal.getPopup();
            popup.addEventListener("paste", (e) => {
                const items = e.clipboardData.items;
                for (const item of items) {
                    if (item.type.startsWith("image/")) {
                        pastedBlob = item.getAsFile();
                        const url = URL.createObjectURL(pastedBlob);
                        document.getElementById("preview").innerHTML = `<img src="${url}" style="max-width:100%;max-height:500px" />`;
                    }
                }
            });
        },
        preConfirm: () => {
            if (!pastedBlob) {
                Swal.showValidationMessage("Eerst een screenshot plakken aub");
                return false;
            }
            return pastedBlob;
        }
    });
    if (result.isConfirmed) {
        const [ok_date, from_day, nbr_days] = await __get_from_till_date();
        if (!ok_date) return false
        await __post_document(result.value, type, from_day, nbr_days, student);
    }
}

// send the attest to the server
async function __post_document(file_blob, type, from_day, nbr_days, student) {
    try {
        const data = new FormData();
        const resized_image = new File([file_blob], `${type}.jpg`, {type: file_blob.type, lastModified: Date.now()})
        data.append("document_type", type);
        data.append("document_scan", true);
        data.append("from_day", from_day);
        data.append("nbr_days", nbr_days);
        data.append("username", student.username)
        data.append("coaccount_nbr", 5)
        data.append("attachment_file", resized_image);
        await fetch_post("document.document", data, true);
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

// display a popup to set the start and end date of the attest
async function __get_from_till_date() {
    try {
        const now = new Date()
        let nbr_of_days = 0;
        let from_day_value = null;
        let from_day = null;
        const result_date = await Swal.fire({
            title: "Start- en einddatum",
            html: `
                <div style="text-align:left;">
                    Datum: ${now.toLocaleDateString("nl-NL", {weekday: "long", year: "numeric", month: "long", day: "numeric"})}<br>
                    Van: <input type="date" id="absent-from-day"><br>
                    Tem: <input type="date" id="absent-till-day"><br>
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
                return true
            },
            didRender: () => {
                const today = new Date().toISOString().split("T")[0];
                document.getElementById("absent-from-day").value = today;
            }
        });
        return result_date.isConfirmed ? [true, from_day.toISOString().substring(0, 10), nbr_of_days] : [false, null, null]
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
    return [false, null, null]
}

// decrease the size (in bytes) of the image
async function __crop_image(base64_image) {
    try {
        const cropper_html = `
        <div id="crop-wrap" style="width:500px; height:70vh; max-width:90vw;">
            <img id="crop-image" src="${base64_image}" style="max-width:100%; max-height:100%; display:block;">
        </div> 
        <button id="rotate-btn" class="swal2-confirm swal2-styled" style="background:#444; width:150px;"> Roteer 90° </button> `;
        let cropper;
        const result = await Swal.fire({
            title: "Bijsnijden",
            html: cropper_html,
            confirmButtonText: "Ok",
            showCancelButton: true,
            cancelButtonText: "Annuleer",
            width: "600px",
            didOpen: () => {
                const image = Swal.getPopup().querySelector("#crop-image");
                cropper = new Cropper(image, {viewMode: 1, movable: true, zoomable: true, background: false});
                const rotate_button = Swal.getPopup().querySelector("#rotate-btn");
                rotate_button.addEventListener("click", () => {cropper.rotate(90);    /* Rotate clockwise 90° */});
            },
            preConfirm: async () => {
                const maxBytes = 1_000_000;
                let maxW = 1600;          // start cap
                let quality = 1;

                for (let attempt = 0; attempt < 8; attempt++) {
                    const canvas = cropper.getCroppedCanvas({maxWidth: maxW, maxHeight: maxW, imageSmoothingEnabled: true, imageSmoothingQuality: "high",});
                    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
                    if (!blob) throw new Error("Export failed");
                    if (blob.size <= maxBytes) return blob
                    // Too big → reduce quality first, then dimensions
                    if (quality > 0.6) quality -= 0.08;
                    else maxW = Math.round(maxW * 0.85);
                }
            }
        });
        return result.isConfirmed ? [true, result.value] : [false, null]
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
    return [false, null]
}

const context_menu_items =
    Object.entries(meta.document_type_labels).map(([t, l]) => ({type: "item", label: `Scan ${l}`, iconscout: "camera", cb: ids => __scan_attest(ids, t, l)})).concat(
        Object.entries(meta.document_type_labels).map(([t, l]) => ({type: "item", label: `Plak ${l}`, iconscout: "copy", cb: ids => __paste_attest(ids, t, l)})));

$(document).ready(function () {
    const ctx = datatables_init({context_menu_items});
});
