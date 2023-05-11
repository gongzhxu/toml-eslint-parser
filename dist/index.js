import { parseForESLint } from "./parser";
import { traverseNodes } from "./traverse";
import { getStaticTOMLValue } from "./utils";
import { KEYS } from "./visitor-keys";
import { ParseError } from "./errors";
export * as meta from "./meta";
export { name } from "./meta";
export { ParseError };
// parser
export { parseForESLint };
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS;
// tools
export { traverseNodes, getStaticTOMLValue };
/**
 * Parse TOML source code
 */
export function parseTOML(code, options) {
    return parseForESLint(code, options).ast;
}
//# sourceMappingURL=index.js.map