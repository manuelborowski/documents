export const dayPartField = `<div id="day-part-field" hidden>
    <label for="day-part-select">Dagdeel</label>
    <select id="day-part-select">
        <option value="whole_day">Hele dag</option>
        <option value="am">Voormiddag (AM)</option>
        <option value="pm">Namiddag (PM)</option>
    </select>
</div>`;

export function bindDayPartField(singleDay) {
    const refresh = () => {
        const field = document.getElementById("day-part-field");
        field.hidden = !singleDay();
        if (field.hidden) document.getElementById("day-part-select").value = "whole_day";
    };
    for (const input of Swal.getPopup().querySelectorAll('input[type="date"], #nbr-days-select')) {
        input.addEventListener("change", refresh);
    }
    refresh();
}

export function sameDayDates() {
    const from = document.getElementById("absent-from-day").value;
    return Boolean(from) && from === document.getElementById("absent-till-day").value;
}

export function selectedDayPart(nbrDays) {
    return nbrDays === 1 ? document.getElementById("day-part-select").value : "whole_day";
}

export function dayPartLabel(doc) {
    const labels = {am: "Voormiddag (AM)", pm: "Namiddag (PM)", whole_day: "Hele dag"};
    return doc.nbr_days === 1 ? ", " + labels[doc.day_part || "whole_day"] : "";
}
