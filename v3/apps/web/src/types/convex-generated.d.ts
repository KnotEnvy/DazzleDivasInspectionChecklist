declare module "convex/_generated/api" {
  export const api: any;
  export const internal: any;
}

declare module "convex/_generated/dataModel" {
  export type Id<TableName extends string = string> = string & {
    __tableName?: TableName;
  };
}