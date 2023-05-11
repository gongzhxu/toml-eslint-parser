import { last } from "./internal-utils";
/**
 * Gets the static value for the given node.
 */
export function getStaticTOMLValue(node) {
    return resolveValue(node);
}
/**
 * Resolve TOML value
 */
function resolveValue(node, baseTable) {
    return resolver[node.type](node, baseTable);
}
const resolver = {
    Program(node, baseTable = {}) {
        return resolveValue(node.body[0], baseTable);
    },
    TOMLTopLevelTable(node, baseTable = {}) {
        for (const body of node.body) {
            resolveValue(body, baseTable);
        }
        return baseTable;
    },
    TOMLKeyValue(node, baseTable = {}) {
        const value = resolveValue(node.value);
        set(baseTable, getStaticTOMLValue(node.key), value);
        return baseTable;
    },
    TOMLTable(node, baseTable = {}) {
        const table = getTable(baseTable, getStaticTOMLValue(node.key), node.kind === "array");
        for (const body of node.body) {
            resolveValue(body, table);
        }
        return baseTable;
    },
    TOMLArray(node) {
        return node.elements.map((e) => getStaticTOMLValue(e));
    },
    TOMLInlineTable(node) {
        const table = {};
        for (const body of node.body) {
            resolveValue(body, table);
        }
        return table;
    },
    TOMLKey(node) {
        return node.keys.map((key) => getStaticTOMLValue(key));
    },
    TOMLBare(node) {
        return node.name;
    },
    TOMLQuoted(node) {
        return node.value;
    },
    TOMLValue(node) {
        return node.value;
    },
};
/**
 * Get the table from the table.
 */
function getTable(baseTable, keys, array) {
    let target = baseTable;
    for (let index = 0; index < keys.length - 1; index++) {
        const key = keys[index];
        target = getNextTargetFromKey(target, key);
    }
    const lastKey = last(keys);
    const lastTarget = target[lastKey];
    if (lastTarget == null) {
        const tableValue = {};
        target[lastKey] = array ? [tableValue] : tableValue;
        return tableValue;
    }
    if (isValue(lastTarget)) {
        // Update because it is an invalid value.
        const tableValue = {};
        target[lastKey] = array ? [tableValue] : tableValue;
        return tableValue;
    }
    if (!array) {
        if (Array.isArray(lastTarget)) {
            // Update because it is an invalid value.
            const tableValue = {};
            target[lastKey] = tableValue;
            return tableValue;
        }
        return lastTarget;
    }
    if (Array.isArray(lastTarget)) {
        // New record
        const tableValue = {};
        lastTarget.push(tableValue);
        return tableValue;
    }
    // Update because it is an invalid value.
    const tableValue = {};
    target[lastKey] = [tableValue];
    return tableValue;
    /** Get next target from key */
    function getNextTargetFromKey(currTarget, key) {
        const nextTarget = currTarget[key];
        if (nextTarget == null) {
            const val = {};
            currTarget[key] = val;
            return val;
        }
        if (isValue(nextTarget)) {
            // Update because it is an invalid value.
            const val = {};
            currTarget[key] = val;
            return val;
        }
        let resultTarget = nextTarget;
        while (Array.isArray(resultTarget)) {
            const lastIndex = resultTarget.length - 1;
            const nextElement = resultTarget[lastIndex];
            if (isValue(nextElement)) {
                // Update because it is an invalid value.
                const val = {};
                resultTarget[lastIndex] = val;
                return val;
            }
            resultTarget = nextElement;
        }
        return resultTarget;
    }
}
/**
 * Set the value to the table.
 */
function set(baseTable, keys, value) {
    let target = baseTable;
    for (let index = 0; index < keys.length - 1; index++) {
        const key = keys[index];
        const nextTarget = target[key];
        if (nextTarget == null) {
            const val = {};
            target[key] = val;
            target = val;
        }
        else {
            if (isValue(nextTarget) || Array.isArray(nextTarget)) {
                // Update because it is an invalid value.
                const val = {};
                target[key] = val;
                target = val;
            }
            else {
                target = nextTarget;
            }
        }
    }
    target[last(keys)] = value;
}
/**
 * Check whether the given value is a value.
 */
function isValue(value) {
    return typeof value !== "object" || value instanceof Date;
}
//# sourceMappingURL=utils.js.map