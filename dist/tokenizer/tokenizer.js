import { ParseError } from "../errors";
import { CodePointIterator } from "./code-point-iterator";
import { EOF, LINE_FEED, NULL, isWhitespace, isEOL, EQUALS_SIGN, QUOTATION_MARK, LATIN_SMALL_B, BACKSLASH, LATIN_SMALL_T, LATIN_SMALL_N, LATIN_SMALL_F, LATIN_SMALL_R, BACKSPACE, TABULATION, FORM_FEED, CARRIAGE_RETURN, LATIN_SMALL_U, LATIN_CAPITAL_U, isHexDig, isLetter, isDigit, UNDERSCORE, DASH, isControl, DELETE, HASH, DOT, SINGLE_QUOTE, LATIN_SMALL_A, LATIN_SMALL_I, PLUS_SIGN, DIGIT_0, LATIN_SMALL_O, LATIN_SMALL_X, LATIN_SMALL_E, LATIN_CAPITAL_E, LATIN_SMALL_S, LATIN_SMALL_L, LEFT_BRACKET, RIGHT_BRACKET, LEFT_BRACE, RIGHT_BRACE, COMMA, isOctalDig, DIGIT_1, LATIN_CAPITAL_T, SPACE, COLON, LATIN_CAPITAL_Z, LATIN_SMALL_Z, isUnicodeScalarValue, } from "./code-point";
const HAS_BIGINT = typeof BigInt !== "undefined";
const RADIX_PREFIXES = {
    16: "0x",
    10: "",
    8: "0o",
    2: "02",
};
const ESCAPES = {
    [LATIN_SMALL_B]: BACKSPACE,
    [LATIN_SMALL_T]: TABULATION,
    [LATIN_SMALL_N]: LINE_FEED,
    [LATIN_SMALL_F]: FORM_FEED,
    [LATIN_SMALL_R]: CARRIAGE_RETURN,
    [QUOTATION_MARK]: QUOTATION_MARK,
    [BACKSLASH]: BACKSLASH,
};
/**
 * Tokenizer for TOML.
 */
export class Tokenizer {
    text;
    parserOptions;
    codePointIterator;
    backCode = false;
    lastCodePoint = NULL;
    state = "DATA";
    token = null;
    tokenStart = {
        offset: -1,
        line: 1,
        column: -1,
    };
    data;
    /**
     * The flag which enables values tokens.
     * If this is true, this tokenizer will generate Integer, Float, Boolean, Offset Date-Time, Local Date-Time ,Local Date, Local Time, Array and Inline Table tokens.
     */
    valuesEnabled = false;
    /**
     * Initialize this tokenizer.
     */
    constructor(text, parserOptions) {
        this.text = text;
        this.parserOptions = parserOptions || {};
        this.codePointIterator = new CodePointIterator(text);
    }
    get positions() {
        return {
            start: this.codePointIterator.start,
            end: this.codePointIterator.end,
        };
    }
    /**
     * Report an invalid character error.
     */
    reportParseError(code, data) {
        throw new ParseError(code, this.codePointIterator.start.offset, this.codePointIterator.start.line, this.codePointIterator.start.column, data);
    }
    /**
     * Get the next token.
     */
    nextToken() {
        let token = this.token;
        if (token != null) {
            this.token = null;
            return token;
        }
        let cp = this.lastCodePoint;
        while (cp !== EOF && !this.token) {
            cp = this.nextCode();
            const nextState = this[this.state](cp);
            if (!nextState) {
                throw new Error(`Unknown error: pre state=${this.state}`);
            }
            this.state = nextState;
        }
        token = this.token;
        this.token = null;
        return token;
    }
    /**
     * Get the next code point.
     */
    nextCode() {
        if (this.lastCodePoint === EOF) {
            return EOF;
        }
        if (this.backCode) {
            this.backCode = false;
            return this.lastCodePoint;
        }
        return (this.lastCodePoint = this.codePointIterator.next());
    }
    /**
     * Skip code point iterator.
     */
    skip(count) {
        if (this.backCode) {
            this.backCode = false;
            count--;
        }
        if (!count) {
            return;
        }
        count--;
        for (let index = 0; index < count; index++) {
            this.codePointIterator.next();
        }
        this.lastCodePoint = this.codePointIterator.next();
    }
    /**
     * Back the current code point as the given state.
     */
    back(state) {
        this.backCode = true;
        return state;
    }
    punctuatorToken(cp) {
        this.startToken();
        this.endToken("Punctuator", "end", cp);
    }
    startToken() {
        this.tokenStart = {
            ...this.codePointIterator.start,
        };
    }
    /**
     * Commit the current token.
     */
    endToken(type, pos, option1, option2) {
        const { tokenStart } = this;
        const end = this.codePointIterator[pos];
        const range = [tokenStart.offset, end.offset];
        const loc = {
            start: {
                line: tokenStart.line,
                column: tokenStart.column,
            },
            end: {
                line: end.line,
                column: end.column,
            },
        };
        if (type === "Block") {
            this.token = {
                type,
                value: this.text.slice(tokenStart.offset + 1, end.offset),
                range,
                loc,
            };
        }
        else {
            let token;
            const value = type === "Punctuator"
                ? String.fromCodePoint(option1)
                : this.text.slice(tokenStart.offset, end.offset);
            if (type === "BasicString" ||
                type === "LiteralString" ||
                type === "MultiLineBasicString" ||
                type === "MultiLineLiteralString") {
                token = {
                    type,
                    value,
                    string: String.fromCodePoint(...option1),
                    range,
                    loc,
                };
            }
            else if (type === "Integer") {
                const text = String.fromCodePoint(...option1);
                token = {
                    type,
                    value,
                    number: parseInt(text, option2),
                    bigint: HAS_BIGINT
                        ? BigInt(RADIX_PREFIXES[option2] + text)
                        : null,
                    range,
                    loc,
                };
            }
            else if (type === "Float") {
                token = {
                    type,
                    value,
                    number: option1,
                    range,
                    loc,
                };
            }
            else if (type === "Boolean") {
                token = {
                    type,
                    value,
                    boolean: option1,
                    range,
                    loc,
                };
            }
            else {
                token = {
                    type,
                    value,
                    range,
                    loc,
                };
            }
            this.token = token;
        }
    }
    DATA(cp) {
        while (isWhitespace(cp) || isEOL(cp)) {
            cp = this.nextCode();
        }
        if (cp === HASH) {
            this.startToken();
            return "COMMENT";
        }
        if (cp === QUOTATION_MARK) {
            this.startToken();
            return "BASIC_STRING";
        }
        if (cp === SINGLE_QUOTE) {
            this.startToken();
            return "LITERAL_STRING";
        }
        if (cp === DOT || // .
            cp === EQUALS_SIGN || // =
            cp === LEFT_BRACKET || // [
            cp === RIGHT_BRACKET || // ]
            cp === LEFT_BRACE || // {
            cp === RIGHT_BRACE || // }
            cp === COMMA // ,
        ) {
            this.punctuatorToken(cp);
            return "DATA";
        }
        if (this.valuesEnabled) {
            if (cp === DASH || cp === PLUS_SIGN) {
                this.startToken();
                return "SIGN";
            }
            if (cp === LATIN_SMALL_N || cp === LATIN_SMALL_I) {
                this.startToken();
                return this.back("NAN_OR_INF");
            }
            if (isDigit(cp)) {
                this.startToken();
                return this.back("NUMBER");
            }
            if (cp === LATIN_SMALL_T || cp === LATIN_SMALL_F) {
                this.startToken();
                return this.back("BOOLEAN");
            }
        }
        else {
            if (isBare(cp)) {
                this.startToken();
                return "BARE";
            }
        }
        if (cp === EOF) {
            // end
            return "DATA";
        }
        return this.reportParseError("unexpected-char");
    }
    COMMENT(cp) {
        while (!isEOL(cp) && cp !== EOF) {
            if (isControlOtherThanTab(cp)) {
                return this.reportParseErrorControlChar();
            }
            cp = this.nextCode();
        }
        this.endToken("Block", "start");
        return "DATA";
    }
    BARE(cp) {
        while (isBare(cp)) {
            cp = this.nextCode();
        }
        this.endToken("Bare", "start");
        return this.back("DATA");
    }
    BASIC_STRING(cp) {
        if (cp === QUOTATION_MARK) {
            cp = this.nextCode();
            if (cp === QUOTATION_MARK) {
                return "MULTI_LINE_BASIC_STRING";
            }
            this.endToken("BasicString", "start", []);
            return this.back("DATA");
        }
        const codePoints = [];
        while (cp !== QUOTATION_MARK && cp !== EOF && cp !== LINE_FEED) {
            if (isControlOtherThanTab(cp)) {
                return this.reportParseErrorControlChar();
            }
            if (cp === BACKSLASH) {
                cp = this.nextCode();
                const ecp = ESCAPES[cp];
                if (ecp) {
                    codePoints.push(ecp);
                    cp = this.nextCode();
                    continue;
                }
                else if (cp === LATIN_SMALL_U) {
                    const code = this.parseUnicode(4);
                    codePoints.push(code);
                    cp = this.nextCode();
                    continue;
                }
                else if (cp === LATIN_CAPITAL_U) {
                    const code = this.parseUnicode(8);
                    codePoints.push(code);
                    cp = this.nextCode();
                    continue;
                }
                return this.reportParseError("invalid-char-in-escape-sequence");
            }
            codePoints.push(cp);
            cp = this.nextCode();
        }
        if (cp !== QUOTATION_MARK) {
            return this.reportParseError("unterminated-string");
        }
        this.endToken("BasicString", "end", codePoints);
        return "DATA";
    }
    MULTI_LINE_BASIC_STRING(cp) {
        const codePoints = [];
        if (cp === LINE_FEED) {
            // A newline immediately following the opening delimiter will be trimmed.
            cp = this.nextCode();
        }
        while (cp !== EOF) {
            if (cp !== LINE_FEED && isControlOtherThanTab(cp)) {
                return this.reportParseErrorControlChar();
            }
            if (cp === QUOTATION_MARK) {
                const nextPoints = this.codePointIterator.subCodePoints();
                if (nextPoints.next() === QUOTATION_MARK &&
                    nextPoints.next() === QUOTATION_MARK) {
                    if (nextPoints.next() === QUOTATION_MARK) {
                        codePoints.push(QUOTATION_MARK);
                        if (nextPoints.next() === QUOTATION_MARK) {
                            codePoints.push(QUOTATION_MARK);
                            if (nextPoints.next() === QUOTATION_MARK) {
                                return this.reportParseError("invalid-three-quotes");
                            }
                        }
                    }
                    this.skip(nextPoints.count - 1);
                    // end
                    this.endToken("MultiLineBasicString", "end", codePoints);
                    return "DATA";
                }
            }
            if (cp === BACKSLASH) {
                cp = this.nextCode();
                const ecp = ESCAPES[cp];
                if (ecp) {
                    codePoints.push(ecp);
                    cp = this.nextCode();
                    continue;
                }
                else if (cp === LATIN_SMALL_U) {
                    const code = this.parseUnicode(4);
                    codePoints.push(code);
                    cp = this.nextCode();
                    continue;
                }
                else if (cp === LATIN_CAPITAL_U) {
                    const code = this.parseUnicode(8);
                    codePoints.push(code);
                    cp = this.nextCode();
                    continue;
                }
                else if (cp === LINE_FEED) {
                    cp = this.nextCode();
                    while (isWhitespace(cp) || cp === LINE_FEED) {
                        cp = this.nextCode();
                    }
                    continue;
                }
                else if (isWhitespace(cp)) {
                    let valid = true;
                    for (const nextCp of this.codePointIterator.iterateSubCodePoints()) {
                        if (nextCp === LINE_FEED) {
                            break;
                        }
                        if (!isWhitespace(nextCp)) {
                            valid = false;
                            break;
                        }
                    }
                    if (valid) {
                        cp = this.nextCode();
                        while (isWhitespace(cp) || cp === LINE_FEED) {
                            cp = this.nextCode();
                        }
                        continue;
                    }
                }
                return this.reportParseError("invalid-char-in-escape-sequence");
            }
            codePoints.push(cp);
            cp = this.nextCode();
        }
        return this.reportParseError("unterminated-string");
    }
    LITERAL_STRING(cp) {
        if (cp === SINGLE_QUOTE) {
            cp = this.nextCode();
            if (cp === SINGLE_QUOTE) {
                return "MULTI_LINE_LITERAL_STRING";
            }
            this.endToken("LiteralString", "start", []);
            return this.back("DATA");
        }
        const codePoints = [];
        while (cp !== SINGLE_QUOTE && cp !== EOF && cp !== LINE_FEED) {
            if (isControlOtherThanTab(cp)) {
                return this.reportParseErrorControlChar();
            }
            codePoints.push(cp);
            cp = this.nextCode();
        }
        if (cp !== SINGLE_QUOTE) {
            return this.reportParseError("unterminated-string");
        }
        this.endToken("LiteralString", "end", codePoints);
        return "DATA";
    }
    MULTI_LINE_LITERAL_STRING(cp) {
        const codePoints = [];
        if (cp === LINE_FEED) {
            // A newline immediately following the opening delimiter will be trimmed.
            cp = this.nextCode();
        }
        while (cp !== EOF) {
            if (cp !== LINE_FEED && isControlOtherThanTab(cp)) {
                return this.reportParseErrorControlChar();
            }
            if (cp === SINGLE_QUOTE) {
                const nextPoints = this.codePointIterator.subCodePoints();
                if (nextPoints.next() === SINGLE_QUOTE &&
                    nextPoints.next() === SINGLE_QUOTE) {
                    if (nextPoints.next() === SINGLE_QUOTE) {
                        codePoints.push(SINGLE_QUOTE);
                        if (nextPoints.next() === SINGLE_QUOTE) {
                            codePoints.push(SINGLE_QUOTE);
                            if (nextPoints.next() === SINGLE_QUOTE) {
                                return this.reportParseError("invalid-three-quotes");
                            }
                        }
                    }
                    this.skip(nextPoints.count - 1);
                    // end
                    this.endToken("MultiLineLiteralString", "end", codePoints);
                    return "DATA";
                }
            }
            codePoints.push(cp);
            cp = this.nextCode();
        }
        return this.reportParseError("unterminated-string");
    }
    SIGN(cp) {
        if (cp === LATIN_SMALL_N || cp === LATIN_SMALL_I) {
            return this.back("NAN_OR_INF");
        }
        if (isDigit(cp)) {
            return this.back("NUMBER");
        }
        return this.reportParseError("unexpected-char");
    }
    NAN_OR_INF(cp) {
        if (cp === LATIN_SMALL_N) {
            const codePoints = this.codePointIterator.subCodePoints();
            if (codePoints.next() === LATIN_SMALL_A &&
                codePoints.next() === LATIN_SMALL_N) {
                this.skip(2);
                this.endToken("Float", "end", NaN);
                return "DATA";
            }
        }
        else if (cp === LATIN_SMALL_I) {
            const codePoints = this.codePointIterator.subCodePoints();
            if (codePoints.next() === LATIN_SMALL_N &&
                codePoints.next() === LATIN_SMALL_F) {
                this.skip(2);
                this.endToken("Float", "end", this.text[this.tokenStart.offset] === "-" ? -Infinity : Infinity);
                return "DATA";
            }
        }
        return this.reportParseError("unexpected-char");
    }
    NUMBER(cp) {
        const start = this.text[this.tokenStart.offset];
        const sign = start === "+" ? PLUS_SIGN : start === "-" ? DASH : NULL;
        if (cp === DIGIT_0) {
            if (sign === NULL) {
                const subCodePoints = this.codePointIterator.subCodePoints();
                const nextCp = subCodePoints.next();
                if (isDigit(nextCp)) {
                    const nextNextCp = subCodePoints.next();
                    if ((isDigit(nextNextCp) &&
                        isDigit(subCodePoints.next()) &&
                        subCodePoints.next() === DASH) ||
                        nextNextCp === COLON) {
                        const isDate = nextNextCp !== COLON;
                        const data = {
                            hasDate: isDate,
                            year: 0,
                            month: 0,
                            day: 0,
                            hour: 0,
                            minute: 0,
                            second: 0,
                        };
                        this.data = data;
                        return this.back(isDate ? "DATE_YEAR" : "TIME_HOUR");
                    }
                    return this.reportParseError("invalid-leading-zero");
                }
            }
            cp = this.nextCode();
            if (cp === LATIN_SMALL_X ||
                cp === LATIN_SMALL_O ||
                cp === LATIN_SMALL_B) {
                if (sign !== NULL) {
                    return this.reportParseError("unexpected-char");
                }
                return cp === LATIN_SMALL_X
                    ? "HEX"
                    : cp === LATIN_SMALL_O
                        ? "OCTAL"
                        : "BINARY";
            }
            if (cp === LATIN_SMALL_E || cp === LATIN_CAPITAL_E) {
                const data = {
                    // Float values -0.0 and +0.0 are valid and should map according to IEEE 754.
                    left: sign === DASH ? -0 : 0,
                };
                this.data = data;
                return "EXPONENT_RIGHT";
            }
            if (cp === DOT) {
                const data = {
                    minus: sign === DASH,
                    absInt: 0,
                };
                this.data = data;
                return "FRACTIONAL_RIGHT";
            }
            // Integer values -0 and +0 are valid and identical to an unprefixed zero.
            this.endToken("Integer", "start", [DIGIT_0], 10);
            return this.back("DATA");
        }
        const { codePoints, nextCp, hasUnderscore } = this.parseDigits(cp, isDigit);
        if (nextCp === DASH &&
            sign === NULL &&
            !hasUnderscore &&
            codePoints.length === 4) {
            const data = {
                hasDate: true,
                year: Number(String.fromCodePoint(...codePoints)),
                month: 0,
                day: 0,
                hour: 0,
                minute: 0,
                second: 0,
            };
            this.data = data;
            return "DATE_MONTH";
        }
        if (nextCp === COLON &&
            sign === NULL &&
            !hasUnderscore &&
            codePoints.length === 2) {
            const data = {
                hasDate: false,
                year: 0,
                month: 0,
                day: 0,
                hour: Number(String.fromCodePoint(...codePoints)),
                minute: 0,
                second: 0,
            };
            this.data = data;
            return "TIME_MINUTE";
        }
        if (nextCp === LATIN_SMALL_E || nextCp === LATIN_CAPITAL_E) {
            const absNum = Number(String.fromCodePoint(...codePoints));
            const data = {
                left: sign === DASH ? -absNum : absNum,
            };
            this.data = data;
            return "EXPONENT_RIGHT";
        }
        if (nextCp === DOT) {
            const data = {
                minus: sign === DASH,
                absInt: Number(String.fromCodePoint(...codePoints)),
            };
            this.data = data;
            return "FRACTIONAL_RIGHT";
        }
        this.endToken("Integer", "start", sign === DASH ? [DASH, ...codePoints] : codePoints, 10);
        return this.back("DATA");
    }
    HEX(cp) {
        const { codePoints } = this.parseDigits(cp, isHexDig);
        this.endToken("Integer", "start", codePoints, 16);
        return this.back("DATA");
    }
    OCTAL(cp) {
        const { codePoints } = this.parseDigits(cp, isOctalDig);
        this.endToken("Integer", "start", codePoints, 8);
        return this.back("DATA");
    }
    BINARY(cp) {
        const { codePoints } = this.parseDigits(cp, (c) => c === DIGIT_0 || c === DIGIT_1);
        this.endToken("Integer", "start", codePoints, 2);
        return this.back("DATA");
    }
    FRACTIONAL_RIGHT(cp) {
        const { minus, absInt } = this.data;
        const { codePoints, nextCp } = this.parseDigits(cp, isDigit);
        const absNum = absInt +
            Number(String.fromCodePoint(...codePoints)) *
                Math.pow(10, -codePoints.length);
        if (nextCp === LATIN_SMALL_E || nextCp === LATIN_CAPITAL_E) {
            const data = {
                left: minus ? -absNum : absNum,
            };
            this.data = data;
            return "EXPONENT_RIGHT";
        }
        this.endToken("Float", "start", minus ? -absNum : absNum);
        return this.back("DATA");
    }
    EXPONENT_RIGHT(cp) {
        const { left } = this.data;
        let minus = false;
        if (cp === DASH || cp === PLUS_SIGN) {
            minus = cp === DASH;
            cp = this.nextCode();
        }
        const { codePoints } = this.parseDigits(cp, isDigit);
        let right = Number(String.fromCodePoint(...codePoints));
        if (minus) {
            right = 0 - right;
        }
        this.endToken("Float", "start", left * Math.pow(10, right));
        return this.back("DATA");
    }
    BOOLEAN(cp) {
        if (cp === LATIN_SMALL_T) {
            const codePoints = this.codePointIterator.subCodePoints();
            if (codePoints.next() === LATIN_SMALL_R &&
                codePoints.next() === LATIN_SMALL_U &&
                codePoints.next() === LATIN_SMALL_E) {
                // true
                this.skip(codePoints.count);
                this.endToken("Boolean", "end", true);
                return "DATA";
            }
        }
        else if (cp === LATIN_SMALL_F) {
            const codePoints = this.codePointIterator.subCodePoints();
            if (codePoints.next() === LATIN_SMALL_A &&
                codePoints.next() === LATIN_SMALL_L &&
                codePoints.next() === LATIN_SMALL_S &&
                codePoints.next() === LATIN_SMALL_E) {
                // false
                this.skip(codePoints.count);
                this.endToken("Boolean", "end", false);
                return "DATA";
            }
        }
        return this.reportParseError("unexpected-char");
    }
    DATE_YEAR(cp) {
        // already checked
        const codePoints = [cp, this.nextCode(), this.nextCode(), this.nextCode()];
        this.nextCode(); // hyphen
        const data = this.data;
        data.year = Number(String.fromCodePoint(...codePoints));
        return "DATE_MONTH";
    }
    DATE_MONTH(cp) {
        const codePoints = [];
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (cp !== DASH) {
            return this.reportParseError("unexpected-char");
        }
        const data = this.data;
        data.month = Number(String.fromCodePoint(...codePoints));
        return "DATE_DAY";
    }
    DATE_DAY(cp) {
        const codePoints = [];
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        const data = this.data;
        data.day = Number(String.fromCodePoint(...codePoints));
        if (!isValidDate(data.year, data.month, data.day)) {
            return this.reportParseError("invalid-date");
        }
        cp = this.nextCode();
        if (cp === LATIN_CAPITAL_T || cp === LATIN_SMALL_T) {
            return "TIME_HOUR";
        }
        if (cp === SPACE) {
            const subCodePoints = this.codePointIterator.subCodePoints();
            if (isDigit(subCodePoints.next()) && isDigit(subCodePoints.next())) {
                return "TIME_HOUR";
            }
        }
        this.endToken("LocalDate", "start");
        return this.back("DATA");
    }
    TIME_HOUR(cp) {
        const codePoints = [];
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (cp !== COLON) {
            return this.reportParseError("unexpected-char");
        }
        const data = this.data;
        data.hour = Number(String.fromCodePoint(...codePoints));
        return "TIME_MINUTE";
    }
    TIME_MINUTE(cp) {
        const codePoints = [];
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (cp !== COLON) {
            return this.reportParseError("unexpected-char");
        }
        const data = this.data;
        data.minute = Number(String.fromCodePoint(...codePoints));
        return "TIME_SECOND";
    }
    TIME_SECOND(cp) {
        const codePoints = [];
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (isDigit(cp)) {
            codePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        const data = this.data;
        data.second = Number(String.fromCodePoint(...codePoints));
        if (!isValidTime(data.hour, data.minute, data.second)) {
            return this.reportParseError("invalid-time");
        }
        cp = this.nextCode();
        if (cp === DOT) {
            return "TIME_SEC_FRAC";
        }
        if (data.hasDate) {
            if (cp === DASH || cp === PLUS_SIGN) {
                return "TIME_OFFSET";
            }
            if (cp === LATIN_CAPITAL_Z || cp === LATIN_SMALL_Z) {
                this.endToken("OffsetDateTime", "end");
                return "DATA";
            }
            this.endToken("LocalDateTime", "start");
            return this.back("DATA");
        }
        this.endToken("LocalTime", "start");
        return this.back("DATA");
    }
    TIME_SEC_FRAC(cp) {
        if (!isDigit(cp)) {
            return this.reportParseError("unexpected-char");
        }
        while (isDigit(cp)) {
            cp = this.nextCode();
        }
        const data = this.data;
        if (data.hasDate) {
            if (cp === DASH || cp === PLUS_SIGN) {
                return "TIME_OFFSET";
            }
            if (cp === LATIN_CAPITAL_Z || cp === LATIN_SMALL_Z) {
                this.endToken("OffsetDateTime", "end");
                return "DATA";
            }
            this.endToken("LocalDateTime", "start");
            return this.back("DATA");
        }
        this.endToken("LocalTime", "start");
        return this.back("DATA");
    }
    TIME_OFFSET(cp) {
        if (!isDigit(cp)) {
            return this.reportParseError("unexpected-char");
        }
        const hourCodePoints = [cp];
        cp = this.nextCode();
        if (isDigit(cp)) {
            hourCodePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (cp !== COLON) {
            return this.reportParseError("unexpected-char");
        }
        const minuteCodePoints = [];
        cp = this.nextCode();
        if (isDigit(cp)) {
            minuteCodePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        cp = this.nextCode();
        if (isDigit(cp)) {
            minuteCodePoints.push(cp);
        }
        else {
            return this.reportParseError("unexpected-char");
        }
        const hour = Number(String.fromCodePoint(...hourCodePoints));
        const minute = Number(String.fromCodePoint(...minuteCodePoints));
        if (!isValidTime(hour, minute, 0)) {
            return this.reportParseError("invalid-time");
        }
        this.endToken("OffsetDateTime", "end");
        return "DATA";
    }
    parseDigits(cp, checkDigit) {
        if (cp === UNDERSCORE) {
            return this.reportParseError("invalid-underscore");
        }
        if (!checkDigit(cp)) {
            return this.reportParseError("unexpected-char");
        }
        const codePoints = [];
        let before = NULL;
        let hasUnderscore = false;
        while (checkDigit(cp) || cp === UNDERSCORE) {
            if (cp === UNDERSCORE) {
                hasUnderscore = true;
                if (before === UNDERSCORE) {
                    return this.reportParseError("invalid-underscore");
                }
            }
            else {
                codePoints.push(cp);
            }
            before = cp;
            cp = this.nextCode();
        }
        if (before === UNDERSCORE) {
            return this.reportParseError("invalid-underscore");
        }
        return {
            codePoints,
            nextCp: cp,
            hasUnderscore,
        };
    }
    parseUnicode(count) {
        const codePoints = [];
        for (const cp of this.codePointIterator.iterateSubCodePoints()) {
            if (!isHexDig(cp)) {
                return this.reportParseError("invalid-char-in-escape-sequence");
            }
            codePoints.push(cp);
            if (codePoints.length >= count) {
                break;
            }
        }
        this.skip(codePoints.length);
        const code = String.fromCodePoint(...codePoints);
        const codePoint = parseInt(code, 16);
        if (!isUnicodeScalarValue(codePoint)) {
            return this.reportParseError("invalid-code-point", { cp: code });
        }
        return codePoint;
    }
    reportParseErrorControlChar() {
        return this.reportParseError("invalid-control-character");
    }
}
/**
 * Check whether the code point is [A-Za-z0-9_-]
 */
function isBare(cp) {
    return isLetter(cp) || isDigit(cp) || cp === UNDERSCORE || cp === DASH;
}
/**
 * Check whether the code point is [A-Za-z0-9_-]
 */
function isControlOtherThanTab(cp) {
    return (isControl(cp) && cp !== TABULATION) || cp === DELETE;
}
/**
 * Check whether the given values is valid date
 */
function isValidDate(y, m, d) {
    if (y <= 0 || m > 12 || m <= 0 || d <= 0) {
        return false;
    }
    const maxDayOfMonth = m === 2
        ? y & 3 || (!(y % 25) && y & 15)
            ? 28
            : 29
        : 30 + ((m + (m >> 3)) & 1);
    return d <= maxDayOfMonth;
}
/**
 * Check whether the given values is valid time
 */
function isValidTime(h, m, s) {
    if (h >= 24 || h < 0 || m > 59 || m < 0 || s > 60 || s < 0) {
        return false;
    }
    return true;
}
//# sourceMappingURL=tokenizer.js.map