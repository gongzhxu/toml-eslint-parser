type Position = {
    offset: number;
    line: number;
    column: number;
};
export declare class CodePointIterator {
    readonly text: string;
    private lastCodePoint;
    start: Position;
    end: Position;
    /**
     * Initialize this char iterator.
     */
    constructor(text: string);
    next(): number;
    iterateSubCodePoints(): IterableIterator<number>;
    subCodePoints(): {
        next(): number;
        count: number;
    };
}
export {};
