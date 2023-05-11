import { TOMLParser } from "./toml-parser";
import { KEYS } from "./visitor-keys";
/**
 * Parse source code
 */
export function parseForESLint(code, options) {
    const parser = new TOMLParser(code, options);
    const ast = parser.parse();
    return {
        ast,
        visitorKeys: KEYS,
        services: {
            isTOML: true,
        },
    };
}
//# sourceMappingURL=parser.js.map