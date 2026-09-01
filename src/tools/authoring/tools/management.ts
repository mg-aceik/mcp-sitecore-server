import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runAuthoringOperation } from "../logic/run.js";
import { JOB_SELECTION } from "../logic/selections.js";

/**
 * The management half of the API: publishing, jobs and index rebuilds.
 *
 * All three are asynchronous. Publishing returns an `operationId` and index rebuilds
 * return job handles; nothing has happened yet when the call comes back, so each of these
 * tools names the tool that reads the outcome. An agent that publishes and reports success
 * without checking `authoring-publishing-status` is reporting that a job was *queued*.
 */

export function authoringPublishItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-publish-item",
        {
            description:
                "Queues a publish of one or more items over the Authoring and Management API and "
                + "returns an operationId. Publishing is asynchronous — the call returns as soon as "
                + "the job is queued, so poll authoring-publishing-status with the operationId before "
                + "reporting that content is live. On SitecoreAI the target is 'experienceedge'; on "
                + "XM/XP it is usually 'web'. Supply exactly one of rootItemIds or rootItemPaths.",
            inputSchema: z.object({
                // min(1) rather than a bare array: `requireOneTarget` counts any non-string
                // value as a target, so an empty array would pass the addressing check and
                // then publish nothing at all.
                rootItemIds: z.array(z.string()).min(1).optional()
                    .describe("GUIDs of the items to publish from. Supply this or rootItemPaths."),
                rootItemPaths: z.array(z.string()).min(1).optional()
                    .describe("Paths of the items to publish from, e.g. ['/sitecore/content/Home']. Supply this or rootItemIds."),
                languages: z.array(z.string()).min(1)
                    .describe("The languages to publish, e.g. ['en']. Required."),
                targetDatabases: z.array(z.string()).min(1)
                    .describe(
                        "The publishing targets, e.g. ['experienceedge'] on SitecoreAI or ['web'] on "
                        + "XM/XP. Required. This is the target's *database* name, not the publishing "
                        + "target item's name: on SitecoreAI the item is 'Edge' but the database is "
                        + "'experienceedge', and 'Edge' is rejected. Read the right values from the "
                        + "'Target database' field of /sitecore/system/Publishing targets."
                    ),
                publishItemMode: z.enum(["FULL", "SMART"]).optional().default("SMART")
                    .describe("SMART publishes only what changed; FULL republishes everything under the root regardless. SMART is the default and is what you normally want."),
                publishSubItems: z.boolean().optional()
                    .describe("When true, publish the descendants of each root item too. Off by default, so a bare call publishes one item."),
                publishRelatedItems: z.boolean().optional()
                    .describe("When true, also publish items the content references, such as media and linked datasources. Off by default — a page can go live with unpublished images without this."),
                sourceDatabase: z.string().optional()
                    .describe("The database to publish from. Defaults to master."),
                displayName: z.string().optional()
                    .describe("A label for this publish, shown in Sitecore's publishing UI and job list."),
            }),
        },
        (params) => {
            const invalid = requireOneTarget(params, ["rootItemIds", "rootItemPaths"]);
            if (invalid) {
                return Promise.resolve(invalid);
            }

            const query = `
                mutation PublishItem($input: PublishItemInput!) {
                  publishItem(input: $input) { operationId }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    rootItemIds: params.rootItemIds,
                    rootItemPaths: params.rootItemPaths,
                    languages: params.languages,
                    targetDatabases: params.targetDatabases,
                    publishItemMode: params.publishItemMode,
                    publishSubItems: params.publishSubItems,
                    publishRelatedItems: params.publishRelatedItems,
                    sourceDatabase: params.sourceDatabase,
                    displayName: params.displayName,
                },
            }));
        }
    );
}

export function authoringPublishingStatusTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-publishing-status",
        {
            description:
                "Reads the status of a publish queued by authoring-publish-item. Returns state "
                + "(INITIALIZING, QUEUED, RUNNING, ABORTREQUESTED, ABORTED, FINISHED, UNKNOWN), "
                + "isDone, isFailed and how many items have been processed. Poll this until isDone "
                + "before treating published content as live.",
            inputSchema: z.object({
                publishingOperationId: z.string()
                    .describe("The operationId returned by authoring-publish-item, e.g. '4e8ed033-cb59-4484-aa86-a6a165711710;xmc'. Pass it whole, semicolon and suffix included."),
            }),
        },
        (params) => {
            const query = `
                query PublishingStatus($publishingOperationId: String!) {
                  publishingStatus(publishingOperationId: $publishingOperationId) {
                    state
                    isDone
                    isFailed
                    processed
                    languages { name }
                    targetDatabase { name }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                publishingOperationId: params.publishingOperationId,
            }));
        }
    );
}

export function authoringRebuildIndexesTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-rebuild-indexes",
        {
            description:
                "Starts a rebuild of one or more Sitecore search indexes over the Authoring and "
                + "Management API and returns the jobs it queued. A full rebuild of "
                + "sitecore_master_index is expensive and leaves search results incomplete while it "
                + "runs, so prefer it only when the index is actually stale. Poll the returned job "
                + "names with authoring-get-job. Use authoring-graphql with "
                + "'query { indexes { nodes { name } } }' to list the index names.",
            inputSchema: z.object({
                indexNames: z.array(z.string()).min(1)
                    .describe("The indexes to rebuild, e.g. ['sitecore_master_index']. Required — this tool will not rebuild every index by accident."),
            }),
        },
        (params) => {
            const query = `
                mutation RebuildIndexes($input: RebuildIndexesInput) {
                  rebuildIndexes(input: $input) {
                    jobs {${JOB_SELECTION}
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: { indexNames: params.indexNames },
            }));
        }
    );
}

export function authoringGetJobTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-get-job",
        {
            description:
                "Reads one Sitecore background job by name or handle over the Authoring and "
                + "Management API, returning its state, progress and messages. This is how you find "
                + "out whether an index rebuild or other queued operation finished. Supply exactly "
                + "one of jobName or handle.",
            inputSchema: z.object({
                jobName: z.string().optional()
                    .describe("The exact job name, e.g. 'Index_Update_IndexName=sitecore_master_index'. Supply this or handle."),
                handle: z.string().optional()
                    .describe("The job handle returned when the job was queued. Supply this or jobName."),
            }),
        },
        (params) => {
            const invalid = requireOneTarget(params, ["jobName", "handle"]);
            if (invalid) {
                return Promise.resolve(invalid);
            }

            const query = `
                query GetJob($input: JobQueryInput!) {
                  job(input: $input) {${JOB_SELECTION}
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: { jobName: params.jobName, handle: params.handle },
            }));
        }
    );
}

export function authoringListJobsTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-list-jobs",
        {
            description:
                "Lists Sitecore background jobs over the Authoring and Management API. jobName "
                + "accepts wildcards: '*' for every job, 'myjob*' for names starting with it, "
                + "'*myjob' for names ending with it, '*myjob*' for names containing it. Omit "
                + "jobName to list them all. Use this to find out what the instance is busy with, or "
                + "to locate a job whose exact name you do not know.",
            inputSchema: z.object({
                jobName: z.string().optional()
                    .describe("A job name or wildcard pattern, e.g. '*index'. Omit to list every job."),
                first: z.number().int().positive().optional()
                    .describe("Maximum number of jobs to return."),
            }),
        },
        (params) => {
            const query = `
                query ListJobs($input: JobQueryInput, $first: PaginationAmount) {
                  jobs(input: $input, first: $first) {
                    nodes {${JOB_SELECTION}
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                // An input of `{ jobName: null }` is not the same as no input to this endpoint,
                // so the whole argument is dropped when no pattern was given.
                input: params.jobName !== undefined ? { jobName: params.jobName } : undefined,
                first: params.first,
            }));
        }
    );
}
