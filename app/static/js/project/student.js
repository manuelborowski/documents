import {datatable_row_data_from_id, datatables_init} from "../datatables/dt.js";
import {fetch_post} from "../common/common.js";

// Enables the webcam, display a preview and a capture and load button.
// When the capture button is pressed, a still is taken
// When the load button is pressed, an image can be uploaded
// A new popup appears to crop the still/image and send it to the server
async function __scan_medical_attest(ids) {
    const student = datatable_row_data_from_id(ids[0]);
    const webcamHTML = `
          <div style="display:flex; flex-direction:column; gap:10px; align-items:center;">
            <video id="swal-video" autoplay playsinline 
              style="width:100%; border-radius:10px;">
            </video>
            <button id="capture-btn" class="swal2-confirm swal2-styled" style="margin-top:10px;"> Neem een foto </button>
            <input type="file" id="file-input" accept="image/*" style="display:none;">
            <button id="load-btn" class="swal2-confirm swal2-styled" style="background:#555;"> Of laad een foto </button>
          </div> `;
    const result = await Swal.fire({
        title: `Nieuw medisch attest voor ${student.naam} ${student.voornaam}`,
        html: webcamHTML,
        showCancelButton: true,
        cancelButtonText: "Annuleer",
        showConfirmButton: false,
        didOpen: async () => {
            const popup = Swal.getPopup();
            const video = popup.querySelector("#swal-video");
            const capture_button = popup.querySelector("#capture-btn");
            const load_button = popup.querySelector("#load-btn");
            const file_input = popup.querySelector("#file-input");
            video.srcObject = await navigator.mediaDevices.getUserMedia({video: true}); // start camera
            // capture button: generate a still from the video stream and show the cropping popup
            capture_button.addEventListener("click", () => {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext("2d").drawImage(video, 0, 0);
                const base64 = canvas.toDataURL("image/jpeg", 0.9);
                Swal.close();                // Close this popup
                start_cropping_and_send_to_server(base64, student);
            });
            // load button: display a load-file-popup, load the file and show the cropping popup
            load_button.addEventListener("click", () => file_input.click());
            file_input.addEventListener("change", () => {
                const file = file_input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    Swal.close();                 // Close capture popup
                    start_cropping_and_send_to_server(reader.result, student);
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

async function start_cropping_and_send_to_server(base64_image, student) {
    const cropper_html = `<div> <img id="crop-image" src="${base64_image}" style="width:100%; display:block"> </div> 
      <button id="rotate-btn" class="swal2-confirm swal2-styled" style="background:#444; width:150px;"> Roteer 90° </button> `;
    let cropper;
    const result = await Swal.fire({
        title: "Bijsnijden",
        html: cropper_html,
        confirmButtonText: "Ok",
        showCancelButton: true,
        didOpen: () => {
            const image = Swal.getPopup().querySelector("#crop-image");
            cropper = new Cropper(image, {aspectRatio: 3 / 4, viewMode: 1, movable: true, zoomable: true, background: false}, 25);
            const rotate_button = Swal.getPopup().querySelector("#rotate-btn");
            rotate_button.addEventListener("click", () => {cropper.rotate(90);    /* Rotate clockwise 90° */});
        },
        preConfirm: async () => {
            const maxBytes = 1_000_000;
            let maxW = 1600;          // start cap
            let quality = 0.85;

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
        const resized_image = new File([result.value], "medischattest.jpg", {type: result.value.type, lastModified: Date.now()})

        data.append("document_type", "medischattest");
        data.append("username", student.username)
        data.append("coaccount_nbr", 0)
        data.append("attachment_file", resized_image);
        await fetch_post("document.document", data, true);
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

const context_menu_items = [
    {type: "item", label: 'Scan medisch attest', iconscout: 'camera', cb: __scan_medical_attest},
]

$(document).ready(function () {
    const ctx = datatables_init({context_menu_items});
});
