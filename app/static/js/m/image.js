export class ResizeImage {
    constructor({maxBytes = 1_000_000} = {}) {this.maxBytes = maxBytes;}

    async process(file) {
        if (!file || !file.type.startsWith("image/")) throw new Error("Invalid image file");
        const img = await new Promise(resolve => {const img = new Image();img.onload = () => resolve(img);img.src = URL.createObjectURL(file);});
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");

        let width = img.width;
        let height = img.height;

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0);

        // 1️⃣ Try reducing quality
        let quality = 0.9;
        let blob;

        do {
            blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
            if (blob.size <= this.maxBytes) break;
            quality -= 0.1;
        } while (quality >= 0.4);

        // 2️⃣ If still too large → scale down
        while (blob.size > this.maxBytes) {
            width = Math.round(width * 0.85);
            height = Math.round(height * 0.85);
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        }
        return blob
    }
}

