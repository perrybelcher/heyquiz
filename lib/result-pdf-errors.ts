/** Public, content-free failures shared by the PDF model, renderer and route. */
export class PdfRenderError extends Error {
    constructor(public readonly code: string, public readonly status: number, message: string) {
        super(message);
        this.name = "PdfRenderError";
    }
}
