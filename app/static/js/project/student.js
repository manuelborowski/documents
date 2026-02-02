import {datatable_row_data_from_id, datatables_init} from "../datatables/dt.js";
import {fetch_post} from "../common/common.js";

async function __scan_medisch_attest(ids) {
    __scan__attest(ids[0], "medischattest");
}

async function __scan_ouder_attest(ids) {
    __scan__attest(ids[0], "ouderattest");
}

// Enables the webcam, display a preview and a capture and load button.
// When the capture button is pressed, a still is taken
// When the load button is pressed, an image can be uploaded
// A new popup appears to crop the still/image and send it to the server
async function __scan__attest(id, type) {
    const student = datatable_row_data_from_id(id);
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
        title: `Nieuw ${type === "medischattest" ? "medisch " : "ouder"}attest voor ${student.naam} ${student.voornaam}`,
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
            capture_button.addEventListener("click", () => {
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
                start_cropping_and_send_to_server(base64, student, type);
            });
            // load button: display a load-file-popup, load the file and show the cropping popup
            load_button.addEventListener("click", () => file_input.click());
            file_input.addEventListener("change", () => {
                const file = file_input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    Swal.close();                 // Close capture popup
                    start_cropping_and_send_to_server(reader.result, student, type);
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

async function __paste_ouder_attest(ids) {
    const student = datatable_row_data_from_id(ids[0]);
    let pastedBlob = null;
    const result = await Swal.fire({
        title: `Plak een nieuw ouderattest voor ${student.naam} ${student.voornaam}`,
        html: ` <div id="preview" style="margin-top:10px"></div> `,
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
        try {
            const type = "ouderattest";
            const data = new FormData();
            const resized_image = new File([result.value], `${type}.jpg`, {type: result.value.type, lastModified: Date.now()})
            data.append("document_type", type);
            data.append("document_scan", true);
            data.append("username", student.username)
            data.append("coaccount_nbr", 5)
            data.append("attachment_file", resized_image);
            await fetch_post("document.document", data, true);
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        }
    }
}


async function start_cropping_and_send_to_server(base64_image, student, type) {
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
    if (!result.isConfirmed) return;
    try {
        const data = new FormData();
        const resized_image = new File([result.value], `${type}.jpg`, {type: result.value.type, lastModified: Date.now()})
        data.append("document_type", type);
        data.append("document_scan", true);
        data.append("username", student.username)
        data.append("coaccount_nbr", 5)
        data.append("attachment_file", resized_image);
        await fetch_post("document.document", data, true);
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

const context_menu_items = [
    {type: "item", label: 'Scan medisch attest', iconscout: 'camera', cb: __scan_medisch_attest},
    {type: "item", label: 'Scan ouderattest', iconscout: 'camera', cb: __scan_ouder_attest},
    {type: "item", label: 'Kopieer/Plak ouderattest', iconscout: 'camera', cb: __paste_ouder_attest},
]

$(document).ready(function () {
    const ctx = datatables_init({context_menu_items});
});
