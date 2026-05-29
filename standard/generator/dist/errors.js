export class GeneratorError extends Error {
    code;
    file;
    entry;
    field;
    constructor(args) {
        super(args.message);
        this.name = "GeneratorError";
        this.code = args.code;
        this.file = args.file;
        this.entry = args.entry;
        this.field = args.field;
    }
}
export function formatGeneratorError(error) {
    if (!(error instanceof GeneratorError)) {
        return String(error instanceof Error ? error.message : error);
    }
    const lines = [`ERROR ${error.code}`];
    if (error.file)
        lines.push(`file: ${error.file}`);
    if (error.entry)
        lines.push(`entry: ${error.entry}`);
    if (error.field)
        lines.push(`field: ${error.field}`);
    lines.push(`message: ${error.message}`);
    return lines.join("\n");
}
//# sourceMappingURL=errors.js.map