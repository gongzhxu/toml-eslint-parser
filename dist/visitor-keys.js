import { unionWith } from "eslint-visitor-keys";
const tomlKeys = {
    Program: ["body"],
    TOMLTopLevelTable: ["body"],
    TOMLTable: ["key", "body"],
    TOMLKeyValue: ["key", "value"],
    TOMLKey: ["keys"],
    TOMLArray: ["elements"],
    TOMLInlineTable: ["body"],
    TOMLBare: [],
    TOMLQuoted: [],
    TOMLValue: [],
};
export const KEYS = unionWith(tomlKeys);
//# sourceMappingURL=visitor-keys.js.map