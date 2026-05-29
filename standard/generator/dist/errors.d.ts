export type GeneratorErrorCode = "AXTP-GEN-1001" | "AXTP-GEN-1002" | "AXTP-GEN-1003" | "AXTP-GEN-1004" | "AXTP-GEN-1005" | "AXTP-GEN-1006" | "AXTP-GEN-1007" | "AXTP-GEN-1008";
export declare class GeneratorError extends Error {
    readonly code: GeneratorErrorCode;
    readonly file?: string;
    readonly entry?: string;
    readonly field?: string;
    constructor(args: {
        code: GeneratorErrorCode;
        message: string;
        file?: string;
        entry?: string;
        field?: string;
    });
}
export declare function formatGeneratorError(error: unknown): string;
