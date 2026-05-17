import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { validate } from "../../middleware/validate.js";
import { issueService, companyService, projectService } from "../../services/index.js";
import { logger } from "../../middleware/logger.js";
import { conflict, unauthorized, HttpError } from "../../errors.js";

/**
 * GitHub webhook payload schema for push events
 */
const githubPushEventSchema = z.object({
  ref: z.string(),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    html_url: z.string(),
  }),
  commits: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
      timestamp: z.string(),
      url: z.string(),
      author: z.object({
        name: z.string(),
        email: z.string(),
        username: z.string().optional(),
      }),
      committer: z.object({
        name: z.string(),
        email: z.string(),
        username: z.string().optional(),
      }),
    }),
  ),
  pusher: z.object({
    name: z.string(),
    email: z.string(),
  }),
});

type GitHubPushEvent = z.infer<typeof githubPushEventSchema>;

/**
 * Parsed issue data from commit message
 */
interface ParsedIssue {
  title: string;
  description?: string;
  priority?: "critical" | "high" | "medium" | "low";
  labels?: string[];
}

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 */
function verifyGitHubSignature(
  payload: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) {
    return false;
  }

  // GitHub signature format: sha256=<hex-digest>
  const parts = signature.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const expectedSignature = parts[1];
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const computedSignature = hmac.digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (expectedSignature.length !== computedSignature.length) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const computedBuffer = Buffer.from(computedSignature, "hex");

  return timingSafeEqual(expectedBuffer, computedBuffer);
}

/**
 * Parse commit message for NEW_ISSUE tag and extract issue details
 * 
 * Format:
 * NEW_ISSUE: <title>
 * [PRIORITY: <priority>]
 * [LABELS: <label1>, <label2>, ...]
 * 
 * <description>
 */
function parseCommitForIssue(commitMessage: string): ParsedIssue | null {
  const lines = commitMessage.split("\n");
  
  // Check for NEW_ISSUE tag in first line
  const firstLine = lines[0]?.trim();
  if (!firstLine || !firstLine.startsWith("NEW_ISSUE:")) {
    return null;
  }

  // Extract title (everything after NEW_ISSUE:)
  const title = firstLine.substring("NEW_ISSUE:".length).trim();
  if (!title) {
    return null;
  }

  let priority: ParsedIssue["priority"] = undefined;
  let labels: string[] = [];
  let descriptionStartIndex = 1;

  // Parse optional metadata lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) {
      descriptionStartIndex = i + 1;
      break;
    }

    if (line.startsWith("PRIORITY:")) {
      const priorityValue = line.substring("PRIORITY:".length).trim().toLowerCase();
      if (["critical", "high", "medium", "low"].includes(priorityValue)) {
        priority = priorityValue as ParsedIssue["priority"];
      }
      descriptionStartIndex = i + 1;
    } else if (line.startsWith("LABELS:")) {
      const labelsValue = line.substring("LABELS:".length).trim();
      labels = labelsValue
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      descriptionStartIndex = i + 1;
    } else {
      // Non-metadata line, start of description
      descriptionStartIndex = i;
      break;
    }
  }

  // Extract description (remaining lines after metadata)
  const description = lines
    .slice(descriptionStartIndex)
    .join("\n")
    .trim();

  return {
    title,
    description: description || undefined,
    priority,
    labels: labels.length > 0 ? labels : undefined,
  };
}

/**
 * Check if a webhook delivery has already been processed
 * Uses GitHub's X-GitHub-Delivery header as idempotency key
 */
async function isDeliveryProcessed(
  db: Db,
  deliveryId: string,
): Promise<boolean> {
  // TODO: Implement delivery tracking in database
  // For now, return false to allow all deliveries
  // This will be implemented in a follow-up with a webhook_deliveries table
  return false;
}

/**
 * Mark a webhook delivery as processed
 */
async function markDeliveryProcessed(
  db: Db,
  deliveryId: string,
  repositoryId: number,
  commitId: string,
): Promise<void> {
  // TODO: Implement delivery tracking in database
  // This will be implemented in a follow-up with a webhook_deliveries table
}

/**
 * GitHub webhook routes
 */
export function githubWebhookRoutes(db: Db) {
  const router = Router();

  /**
   * POST /webhooks/github/push
   * 
   * Receives GitHub push events and creates Paperclip issues for commits
   * tagged with NEW_ISSUE.
   * 
   * Security:
   * - Requires valid GitHub webhook signature (HMAC-SHA256)
   * - Validates webhook secret from environment variable
   * - Rejects duplicate deliveries using X-GitHub-Delivery header
   * 
   * Origin Tracking:
   * - Links created issues back to source commits via origin metadata
   * - Stores repository, commit SHA, and commit URL
   */
  router.post(
    "/push",
    validate(githubPushEventSchema),
    async (req: Request, res: Response) => {
      try {
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        if (!webhookSecret) {
          logger.error("GITHUB_WEBHOOK_SECRET not configured");
          throw new HttpError(500, "Webhook secret not configured");
        }

        // Verify GitHub signature
        const signature = req.get("x-hub-signature-256");
        const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
        
        if (!rawBody) {
          logger.error("Raw body not available for signature verification");
          throw unauthorized("Invalid webhook signature");
        }

        if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
          logger.warn(
            { signature, hasRawBody: !!rawBody },
            "GitHub webhook signature verification failed",
          );
          throw unauthorized("Invalid webhook signature");
        }

        // Check for duplicate delivery
        const deliveryId = req.get("x-github-delivery");
        if (!deliveryId) {
          logger.warn("GitHub webhook missing X-GitHub-Delivery header");
          throw new HttpError(400, "Missing delivery ID");
        }

        if (await isDeliveryProcessed(db, deliveryId)) {
          logger.info({ deliveryId }, "Duplicate GitHub webhook delivery rejected");
          res.status(200).json({
            message: "Delivery already processed",
            deliveryId,
          });
          return;
        }

        const payload = req.body as GitHubPushEvent;
        const createdIssues: Array<{ issueId: string; commitId: string; title: string }> = [];

        // Process each commit in the push
        for (const commit of payload.commits) {
          const parsedIssue = parseCommitForIssue(commit.message);
          
          if (!parsedIssue) {
            // Commit doesn't contain NEW_ISSUE tag, skip
            continue;
          }

          logger.info(
            {
              commitId: commit.id,
              repository: payload.repository.full_name,
              title: parsedIssue.title,
            },
            "Creating issue from GitHub commit",
          );

          // TODO: Determine target company and project from webhook configuration
          // For now, this is a placeholder - will be implemented with webhook registration
          const companyId = process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID;
          const projectId = process.env.GITHUB_WEBHOOK_DEFAULT_PROJECT_ID;

          if (!companyId) {
            logger.error("GITHUB_WEBHOOK_DEFAULT_COMPANY_ID not configured");
            throw new HttpError(500, "Webhook company not configured");
          }

          // Create issue with origin tracking
          const issue = await issueService(db).create({
            companyId,
            projectId: projectId || undefined,
            title: parsedIssue.title,
            description: parsedIssue.description,
            priority: parsedIssue.priority || "medium",
            status: "todo",
            origin: {
              kind: "github_commit",
              id: commit.id,
              metadata: {
                repository: payload.repository.full_name,
                repositoryId: payload.repository.id,
                commitSha: commit.id,
                commitUrl: commit.url,
                commitMessage: commit.message,
                commitTimestamp: commit.timestamp,
                author: commit.author,
                pusher: payload.pusher,
                ref: payload.ref,
              },
            },
          });

          createdIssues.push({
            issueId: issue.id,
            commitId: commit.id,
            title: parsedIssue.title,
          });

          // Mark delivery as processed for this commit
          await markDeliveryProcessed(
            db,
            deliveryId,
            payload.repository.id,
            commit.id,
          );
        }

        logger.info(
          {
            deliveryId,
            repository: payload.repository.full_name,
            commitsProcessed: payload.commits.length,
            issuesCreated: createdIssues.length,
          },
          "GitHub webhook processed successfully",
        );

        res.status(200).json({
          message: "Webhook processed successfully",
          deliveryId,
          issuesCreated: createdIssues,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        logger.error({ err: error }, "GitHub webhook processing failed");
        throw new HttpError(500, "Webhook processing failed");
      }
    },
  );

  return router;
}
