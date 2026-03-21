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
import type * as devTools from "../devTools.js";
import type * as http from "../http.js";
import type * as inspections from "../inspections.js";
import type * as jobs from "../jobs.js";
import type * as lib_checklistTemplates from "../lib/checklistTemplates.js";
import type * as lib_inspectionMetrics from "../lib/inspectionMetrics.js";
import type * as lib_inspectionReporting from "../lib/inspectionReporting.js";
import type * as lib_jobDeletion from "../lib/jobDeletion.js";
import type * as lib_jobLifecycle from "../lib/jobLifecycle.js";
import type * as lib_onboardingEmail from "../lib/onboardingEmail.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_propertySummaries from "../lib/propertySummaries.js";
import type * as lib_validators from "../lib/validators.js";
import type * as photos from "../photos.js";
import type * as properties from "../properties.js";
import type * as propertyAssignments from "../propertyAssignments.js";
import type * as roomInspections from "../roomInspections.js";
import type * as scheduling from "../scheduling.js";
import type * as servicePlans from "../servicePlans.js";
import type * as taskResults from "../taskResults.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  devTools: typeof devTools;
  http: typeof http;
  inspections: typeof inspections;
  jobs: typeof jobs;
  "lib/checklistTemplates": typeof lib_checklistTemplates;
  "lib/inspectionMetrics": typeof lib_inspectionMetrics;
  "lib/inspectionReporting": typeof lib_inspectionReporting;
  "lib/jobDeletion": typeof lib_jobDeletion;
  "lib/jobLifecycle": typeof lib_jobLifecycle;
  "lib/onboardingEmail": typeof lib_onboardingEmail;
  "lib/permissions": typeof lib_permissions;
  "lib/propertySummaries": typeof lib_propertySummaries;
  "lib/validators": typeof lib_validators;
  photos: typeof photos;
  properties: typeof properties;
  propertyAssignments: typeof propertyAssignments;
  roomInspections: typeof roomInspections;
  scheduling: typeof scheduling;
  servicePlans: typeof servicePlans;
  taskResults: typeof taskResults;
  templates: typeof templates;
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
