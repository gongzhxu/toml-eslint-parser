/**
 * Get the last element from given array
 */
export function last(arr) {
    return arr[arr.length - 1] ?? null;
}
/**
 * Node to key name
 */
export function toKeyName(node) {
    return node.type === "TOMLBare" ? node.name : node.value;
}
//# sourceMappingURL=index.js.map