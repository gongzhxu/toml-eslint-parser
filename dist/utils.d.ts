import type { TOMLArray, TOMLBare, TOMLContentNode, TOMLInlineTable, TOMLKey, TOMLKeyValue, TOMLProgram, TOMLQuoted, TOMLStringValue, TOMLTable, TOMLTopLevelTable, TOMLValue } from "./ast";
type TOMLContentValue = TOMLValue["value"] | TOMLContentValue[] | TOMLTableValue;
type TOMLTableValue = {
    [key: string]: TOMLContentValue;
};
export declare function getStaticTOMLValue(node: TOMLValue): TOMLValue["value"];
export declare function getStaticTOMLValue(node: TOMLArray): TOMLContentValue[];
export declare function getStaticTOMLValue(node: TOMLContentNode): TOMLContentValue;
export declare function getStaticTOMLValue(node: TOMLProgram | TOMLTopLevelTable | TOMLTable | TOMLKeyValue | TOMLInlineTable): TOMLTableValue;
export declare function getStaticTOMLValue(node: TOMLStringValue | TOMLBare | TOMLQuoted): string;
export declare function getStaticTOMLValue(node: TOMLKey): string[];
export {};
