import { NULL, EOF, LINE_FEED, CARRIAGE_RETURN } from "./code-point";
export class CodePointIterator {
    text;
    lastCodePoint = NULL;
    start = {
        offset: -1,
        line: 1,
        column: -1,
    };
    end = {
        offset: 0,
        line: 1,
        column: 0,
    };
    /**
     * Initialize this char iterator.
     */
    constructor(text) {
        this.text = text;
    }
    next() {
        if (this.lastCodePoint === EOF) {
            return EOF;
        }
        this.start.offset = this.end.offset;
        this.start.line = this.end.line;
        this.start.column = this.end.column;
        const cp = this.text.codePointAt(this.start.offset) ?? EOF;
        if (cp === EOF) {
            this.end = this.start;
            return (this.lastCodePoint = cp);
        }
        const shift = cp >= 0x10000 ? 2 : 1;
        this.end.offset = this.start.offset + shift;
        if (cp === LINE_FEED) {
            this.end.line = this.start.line + 1;
            this.end.column = 0;
        }
        else if (cp === CARRIAGE_RETURN) {
            if (this.text.codePointAt(this.end.offset) === LINE_FEED) {
                this.end.offset++;
                this.end.line = this.start.line + 1;
                this.end.column = 0;
            }
            return (this.lastCodePoint = LINE_FEED);
        }
        else {
            this.end.column = this.start.column + shift;
        }
        return (this.lastCodePoint = cp);
    }
    *iterateSubCodePoints() {
        let index = this.end.offset;
        while (true) {
            let cp = this.text.codePointAt(index) ?? EOF;
            if (cp === CARRIAGE_RETURN) {
                if (this.text.codePointAt(index) === LINE_FEED) {
                    cp = this.text.codePointAt(++index) ?? EOF;
                }
                else {
                    cp = LINE_FEED;
                }
            }
            if (cp === EOF) {
                return;
            }
            yield cp;
            index += cp >= 0x10000 ? 2 : 1;
        }
    }
    subCodePoints() {
        const sub = this.iterateSubCodePoints();
        let end = false;
        let count = 0;
        return {
            next() {
                if (end) {
                    return EOF;
                }
                const r = sub.next();
                if (r.done) {
                    end = true;
                    return EOF;
                }
                count++;
                return r.value;
            },
            get count() {
                return count;
            },
        };
    }
}
//# sourceMappingURL=code-point-iterator.js.map