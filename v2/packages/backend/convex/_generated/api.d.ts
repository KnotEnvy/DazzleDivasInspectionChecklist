/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as inspections from "../inspections.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_validators from "../lib/validators.js";
import type * as photos from "../photos.js";
import type * as properties from "../properties.js";
import type * as propertyAssignments from "../propertyAssignments.js";
import type * as roomInspections from "../roomInspections.js";
import type * as rooms from "../rooms.js";
import type * as seed from "../seed.js";
import type * as taskResults from "../taskResults.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  http: typeof http;
  inspections: typeof inspections;
  "lib/permissions": typeof lib_permissions;
  "lib/validators": typeof lib_validators;
  photos: typeof photos;
  properties: typeof properties;
  propertyAssignments: typeof propertyAssignments;
  roomInspections: typeof roomInspections;
  rooms: typeof rooms;
  seed: typeof seed;
  taskResults: typeof taskResults;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
