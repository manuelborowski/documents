import {fetch_get} from "../common/common.js";

$(document).ready(async function () {
    const student_div = document.getElementById("student-div");
    const new_document_btn = document.getElementById("new-document-btn");

    const meta = await fetch_get("document.meta");
    student_div.innerHTML = `${meta.current_user.first_name} ${meta.current_user.last_name}`

    const document_list = document.getElementById("document-list");
    for (const doc of meta.documents) {
        const div = document.createElement("div");
        div.innerHTML = `${doc.timestamp} ${doc.document_type}`;
        div.dataset.id = doc.id;
        document_list.appendChild(div);
    }
    document_list.addEventListener("click", async e => {
        const div = e.target.closest("div");

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
        } else if (document.type.includes("video")) {
            const new_tab = window.open();
            if (new_tab) {
                const base64_mp4 = `data:${document.type};base64, ` + data.data.file;
                new_tab.document.write(`<title>${filename}</title>`);
                new_tab.document.write(`
                                <html>
                                  <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh; background-color:#000;">
                                    <video controls autoplay style="max-width:100%; max-height:100vh;">
                                      <source src="${base64_mp4}" type="${document.type}">
                                      Your browser does not support the video tag.
                                    </video>
                                  </body>
                                </html>
                              `);
                new_tab.document.close();
            } else {
                alert("Popup blocked! Please allow popups for this site.");
            }
        } else { // default: download
            const linkSource = `data:application/pdf;base64,${data.data.file}`;
            const downloadLink = document.createElement("a");
            downloadLink.href = linkSource;
            downloadLink.download = filename;
            downloadLink.click();
        }


    });

    new_document_btn.addEventListener("click", async () => {
        let document_type = "none";
        while (document_type === "none") {
            const result = await Swal.fire({
                title: "Type document?",
                html: `
                <select id="document-type-select">
                    <option value="none">Maak uw keuze</option>
                    <option value="doktersbriefje">Doktersbriefje</option>
                </select>
                <img src="static/img/take-picture-of-document.png" width=150px><br>
                Leg het document plat en gebruik eventueel plakband of een gewicht.<br>
                Zorg voor een goede belichting.<br>
                Op de smartphone moet het hele document zichtbaar zijn.<br>
                Houd het toestel recht boven het document.<br>
                  `,
                showCloseButton: true,
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: `Ok`,
                confirmButtonAriaLabel: "Thumbs up, great!",
                cancelButtonText: `Annuleer `,
                cancelButtonAriaLabel: "Thumbs down"
            })
            if (result.isDismissed) {
                document_type = "stop";
            } else if (result.isConfirmed) {
                document_type = document.getElementById("document-type-select").value;
                if (document_type !== "none") {
                    document.getElementById("document-field").click();
                    // upload attachments, called when the file select dialog closes.
                    document.getElementById("document-field").addEventListener("change", async e => {
                        const data = new FormData();
                        data.append("document_type", document_type);
                        data.append("username", meta.current_user.username)
                        data.append("attachment_file", e.target.files[0]);
                        const resp = await fetch(Flask.url_for("document.document"), {method: 'POST', body: data});
                        await resp.json()
                    });
                }
            }
        }
    });


});
