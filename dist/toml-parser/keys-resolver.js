import { last, toKeyName } from "../internal-utils";
// eslint-disable-next-line no-shadow -- ??
var ValueKind;
(function (ValueKind) {
    ValueKind[ValueKind["VALUE"] = 0] = "VALUE";
    ValueKind[ValueKind["INTERMEDIATE"] = 1] = "INTERMEDIATE";
})(ValueKind || (ValueKind = {}));
export class KeysResolver {
    rootKeys = new Map();
    tables = [];
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    applyResolveKeyForTable(node) {
        let keys = this.rootKeys;
        const peekKeyIndex = node.key.keys.length - 1;
        for (let index = 0; index < peekKeyIndex; index++) {
            const keyNode = node.key.keys[index];
            const keyName = toKeyName(keyNode);
            node.resolvedKey.push(keyName);
            let keyStore = keys.get(keyName);
            if (!keyStore) {
                keyStore = { node: keyNode, keys: new Map() };
                keys.set(keyName, keyStore);
            }
            else if (keyStore.table === "array") {
                const peekIndex = keyStore.peekIndex;
                node.resolvedKey.push(peekIndex);
                keyStore = keyStore.keys.get(peekIndex);
            }
            keys = keyStore.keys;
        }
        const lastKeyNode = node.key.keys[peekKeyIndex];
        const lastKeyName = toKeyName(lastKeyNode);
        node.resolvedKey.push(lastKeyName);
        const lastKeyStore = keys.get(lastKeyName);
        if (!lastKeyStore) {
            if (node.kind === "array") {
                node.resolvedKey.push(0);
                const newKeyStore = {
                    node: lastKeyNode,
                    keys: new Map(),
                };
                keys.set(lastKeyName, {
                    table: node.kind,
                    node: lastKeyNode,
                    keys: new Map([[0, newKeyStore]]),
                    peekIndex: 0,
                });
                this.tables.push({ node, keys: newKeyStore.keys });
            }
            else {
                const newKeyStore = {
                    table: node.kind,
                    node: lastKeyNode,
                    keys: new Map(),
                };
                keys.set(lastKeyName, newKeyStore);
                this.tables.push({ node, keys: newKeyStore.keys });
            }
        }
        else if (!lastKeyStore.table) {
            if (node.kind === "array") {
                // e.g.
                // [key.foo]
                // [[key]]
                this.ctx.reportParseError("dupe-keys", lastKeyNode);
            }
            else {
                const transformKey = {
                    table: node.kind,
                    node: lastKeyNode,
                    keys: lastKeyStore.keys,
                };
                keys.set(lastKeyName, transformKey);
                this.tables.push({ node, keys: transformKey.keys });
            }
        }
        else if (lastKeyStore.table === "array") {
            if (node.kind === "array") {
                const newKeyStore = {
                    node: lastKeyNode,
                    keys: new Map(),
                };
                const newIndex = lastKeyStore.peekIndex + 1;
                node.resolvedKey.push(newIndex);
                lastKeyStore.keys.set(newIndex, newKeyStore);
                lastKeyStore.peekIndex = newIndex;
                this.tables.push({ node, keys: newKeyStore.keys });
            }
            else {
                // e.g.
                // [[key]]
                // [key]
                this.ctx.reportParseError("dupe-keys", lastKeyNode);
            }
        }
        else {
            // e.g.
            // [key]
            // [key]
            this.ctx.reportParseError("dupe-keys", lastKeyNode);
        }
    }
    verifyDuplicateKeys(node) {
        for (const body of node.body) {
            if (body.type === "TOMLKeyValue") {
                verifyDuplicateKeysForKeyValue(this.ctx, this.rootKeys, body);
            }
        }
        for (const { node: tableNode, keys } of this.tables) {
            for (const body of tableNode.body) {
                verifyDuplicateKeysForKeyValue(this.ctx, keys, body);
            }
        }
    }
}
/**
 * Verify duplicate keys from TOMLKeyValue
 */
function verifyDuplicateKeysForKeyValue(ctx, defineKeys, node) {
    let keys = defineKeys;
    const lastKey = last(node.key.keys);
    for (const keyNode of node.key.keys) {
        const key = toKeyName(keyNode);
        let defineKey = keys.get(key);
        if (defineKey) {
            if (defineKey.value === ValueKind.VALUE) {
                // e.g.
                // key = 42
                // key.foo = 42
                ctx.reportParseError("dupe-keys", getAfterNode(keyNode, defineKey.node));
            }
            else if (lastKey === keyNode) {
                ctx.reportParseError("dupe-keys", getAfterNode(keyNode, defineKey.node));
            }
            else if (defineKey.table) {
                // e.g.
                // key = 42
                // [key]
                // ---
                // [key.foo]
                // [key]
                // foo.bar = 42
                ctx.reportParseError("dupe-keys", getAfterNode(keyNode, defineKey.node));
            }
            defineKey.value = ValueKind.INTERMEDIATE;
        }
        else {
            if (lastKey === keyNode) {
                const keyStore = {
                    value: ValueKind.VALUE,
                    node: keyNode,
                    keys: new Map(),
                };
                defineKey = keyStore;
            }
            else {
                const keyStore = {
                    value: ValueKind.INTERMEDIATE,
                    node: keyNode,
                    keys: new Map(),
                };
                defineKey = keyStore;
            }
            keys.set(key, defineKey);
        }
        keys = defineKey.keys;
    }
    if (node.value.type === "TOMLInlineTable") {
        verifyDuplicateKeysForInlineTable(ctx, keys, node.value);
    }
    else if (node.value.type === "TOMLArray") {
        verifyDuplicateKeysForArray(ctx, keys, node.value);
    }
}
/**
 * Verify duplicate keys from TOMLInlineTable
 */
function verifyDuplicateKeysForInlineTable(ctx, defineKeys, node) {
    for (const body of node.body) {
        verifyDuplicateKeysForKeyValue(ctx, defineKeys, body);
    }
}
/**
 * Verify duplicate keys from TOMLArray
 */
function verifyDuplicateKeysForArray(ctx, defineKeys, node) {
    const keys = defineKeys;
    for (let index = 0; index < node.elements.length; index++) {
        const element = node.elements[index];
        let defineKey = keys.get(index);
        if (defineKey) {
            // Probably not possible.
            ctx.reportParseError("dupe-keys", getAfterNode(element, defineKey.node));
        }
        else {
            defineKey = {
                value: ValueKind.VALUE,
                node: element,
                keys: new Map(),
            };
            defineKeys.set(index, defineKey);
            if (element.type === "TOMLInlineTable") {
                verifyDuplicateKeysForInlineTable(ctx, defineKey.keys, element);
            }
            else if (element.type === "TOMLArray") {
                verifyDuplicateKeysForArray(ctx, defineKey.keys, element);
            }
        }
    }
}
/**
 * Get the after node
 */
function getAfterNode(a, b) {
    return a.range[0] <= b.range[0] ? b : a;
}
//# sourceMappingURL=keys-resolver.js.map