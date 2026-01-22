// Handles the communication with the rfid-usb service

export class Rfid {
    static __managed_state = false;
    static __operational_state = false;
    static __connected_state = true;
    static state = {not_connected: 1, up: 2, down: 3};
    static __cb = null;
    static __api_url = null;
    static __server_url = null;
    static __server_key = null;

    static init = (configuration) => {
        Rfid.__check_state_timer();
        Rfid.__api_url = configuration.api_url;
        Rfid.__server_key = configuration.server_key;
        Rfid.__server_url = configuration.server_url;
        Rfid.__resolution = "resolution" in configuration ? configuration.resolution : "second";
    }

    static set_managed_state = state => {
        Rfid.__managed_state = state;
        Rfid.__process_state_change()
    }

    static set_location = async location => {
        try {
            const ret = await fetch(`${Rfid.__api_url}/location/${location.replaceAll("/", "--SLASH--")}`, {method: 'POST'});
            const status = await ret.json();
            var state = status === "ok";
            if (Rfid.__server_url !== null && state) {
                const encoded_url = encodeURIComponent(encodeURIComponent(Rfid.__server_url));
                const ret = await fetch(`${Rfid.__api_url}/url/${encoded_url}`, {method: 'POST'});
                const status = await ret.json();
                state = (status === "ok") && state;
            }
            if (Rfid.__server_key !== null && state) {
                const ret = await fetch(`${Rfid.__api_url}/api_key/${Rfid.__server_key}`, {method: 'POST'});
                const status = await ret.json();
                state = (status === "ok") && state;
            }
            if (Rfid.__resolution !== null && state) {
                const ret = await fetch(`${Rfid.__api_url}/resolution/${Rfid.__resolution}`, {method: 'POST'});
                const status = await ret.json();
                state = (status === "ok") && state;
            }
            return state
        } catch (e) {
            return false
        }
    }

    static __process_state_change = async () => {
        if (Rfid.__operational_state) {
            try {
                const ret = await fetch(`${Rfid.__api_url}/active/${Rfid.__managed_state ? 1 : 0}`, {method: 'POST'});
                const status = await ret.json();
                Rfid.__operational_state = status === "ok";
            } catch (e) {
                Rfid.__connected_state = false;
                Rfid.__operational_state = false;
            }
        }
        if (Rfid.__cb !== null) {
            const state = Rfid.get_state();
            Rfid.__cb(state);
        }
    }

    static get_state = () => {
        let state = null;
        if (!Rfid.__connected_state) {
            state = Rfid.state.not_connected;
        } else if (Rfid.__managed_state && Rfid.__operational_state) {
            state = Rfid.state.up;
        } else {
            state = Rfid.state.down;
        }
        return state;
    }

    static subscribe_state_change_cb = (cb) => {Rfid.__cb = cb;}

    // if an RFID reader is attached to a USB port (status.port is e.g. COM4), activate the rfidusb server and show the select-location-button
    static __check_state_timer = async () => {
        try {
            var timeout = 2;
            if (Rfid.__api_url) {
                const ret = await fetch(`${Rfid.__api_url}/serial_port`, {signal: AbortSignal.timeout(2000)});
                const status = await ret.json();
                const operational_state = status.port !== "";
                if (operational_state !== Rfid.__operational_state) {
                    Rfid.__operational_state = operational_state;
                    Rfid.__connected_state = true;
                    Rfid.__process_state_change();
                }
            }
        } catch (e) {
            Rfid.__connected_state = false;
            Rfid.__operational_state = false;
            Rfid.__process_state_change();
            timeout = 5;
        }
        setTimeout(Rfid.__check_state_timer, timeout * 1000);
    }
}
