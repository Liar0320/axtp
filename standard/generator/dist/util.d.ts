export declare function normalizeId(value: unknown, context: string): number;
export declare function hex(value: number, width?: number): string;
export declare function cppName(name: string): string;
export declare function cppConstName(name: string): string;
export declare function sortById<T extends {
    id: number;
}>(items: T[]): T[];
export declare function writeTextFile(filePath: string, content: string): Promise<void>;
export declare function toJsonStable(value: unknown): string;
