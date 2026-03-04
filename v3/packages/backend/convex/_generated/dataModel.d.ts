/* eslint-disable */

export type TableNames = string;

export type Id<TableName extends TableNames> = string & {
  __tableName?: TableName;
};

export type Doc<TableName extends TableNames> = any;
export type DataModel = any;
