export type CreateInspectionPayload = {
    propertyId: string;
    type: "CLEANING" | "INSPECTION";
};
export type OutboxItem = {
    id: string;
    type: "CREATE_INSPECTION";
    payload: CreateInspectionPayload;
    createdAt: number;
    attempts: number;
};
export declare function queueCreateInspection(payload: CreateInspectionPayload): Promise<string>;
export declare function getOutboxCount(): Promise<number>;
export declare function getOutboxItems(): Promise<any[]>;
export declare function flushCreateInspectionOutbox(createInspection: (payload: CreateInspectionPayload) => Promise<unknown>): Promise<{
    processed: number;
    failed: number;
}>;
