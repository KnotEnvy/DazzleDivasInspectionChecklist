import { openDB } from "idb";
const DB_NAME = "dazzle-divas-v3";
const STORE = "outbox";
function notifyOutboxChanged() {
    window.dispatchEvent(new Event("dazzle:outbox-changed"));
}
async function db() {
    return await openDB(DB_NAME, 1, {
        upgrade(database) {
            if (!database.objectStoreNames.contains(STORE)) {
                const store = database.createObjectStore(STORE, { keyPath: "id" });
                store.createIndex("createdAt", "createdAt");
            }
        },
    });
}
export async function queueCreateInspection(payload) {
    const database = await db();
    const item = {
        id: crypto.randomUUID(),
        type: "CREATE_INSPECTION",
        payload,
        createdAt: Date.now(),
        attempts: 0,
    };
    await database.put(STORE, item);
    notifyOutboxChanged();
    return item.id;
}
export async function getOutboxCount() {
    const database = await db();
    return await database.count(STORE);
}
export async function getOutboxItems() {
    const database = await db();
    return await database.getAllFromIndex(STORE, "createdAt");
}
export async function flushCreateInspectionOutbox(createInspection) {
    const database = await db();
    const items = await database.getAllFromIndex(STORE, "createdAt");
    let processed = 0;
    let failed = 0;
    for (const item of items) {
        try {
            await createInspection(item.payload);
            await database.delete(STORE, item.id);
            processed += 1;
        }
        catch {
            failed += 1;
            await database.put(STORE, {
                ...item,
                attempts: item.attempts + 1,
            });
        }
    }
    notifyOutboxChanged();
    return { processed, failed };
}
