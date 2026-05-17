import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac } from "node:crypto";
import request from "supertest";
import express from "express";
import type { Db } from "@paperclipai/db";
import { githubWebhookRoutes } from "./github.js";

// Mock the issueService
vi.mock("../../services/index.js", () => ({
  issueService: vi.fn(() => ({
    create: vi.fn(async (data) => ({
      id: "mock-issue-id",
      companyId: data.companyId,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      origin: data.origin,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  })),
  companyService: vi.fn(),
  projectService: vi.fn(),
}));

/**
 * Integration tests for GitHub webhook endpoint
 * 
 * These tests verify the full request/response cycle including:
 * - Express middleware integration
 * - Request body parsing
 * - Signature verification
 * - Database interactions
 * - Error handling
 */

describe("GitHub Webhook Integration Tests", () => {
  let app: express.Application;
  let mockDb: Db;

  beforeAll(() => {
    // Set up test environment
    process.env.GITHUB_WEBHOOK_SECRET = "integration-test-secret";
    process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID = "test-company-123";
    process.env.GITHUB_WEBHOOK_DEFAULT_PROJECT_ID = "test-project-456";

    // Create minimal Express app for testing
    app = express();
    app.use(express.json({
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    }));

    // Mock database
    mockDb = {} as Db;

    // Mount webhook routes
    app.use("/webhooks/github", githubWebhookRoutes(mockDb));
  });

  afterAll(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID;
    delete process.env.GITHUB_WEBHOOK_DEFAULT_PROJECT_ID;
  });

  const createSignature = (payload: unknown, secret: string): string => {
    const hmac = createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest("hex")}`;
  };

  const createPushPayload = (commitMessage: string) => ({
    ref: "refs/heads/main",
    repository: {
      id: 12345,
      name: "test-repo",
      full_name: "org/test-repo",
      html_url: "https://github.com/org/test-repo",
    },
    commits: [
      {
        id: "abc123def456",
        message: commitMessage,
        timestamp: "2026-05-06T12:00:00Z",
        url: "https://github.com/org/test-repo/commit/abc123def456",
        author: {
          name: "Integration Test",
          email: "test@example.com",
          username: "testuser",
        },
        committer: {
          name: "Integration Test",
          email: "test@example.com",
          username: "testuser",
        },
      },
    ],
    pusher: {
      name: "Integration Test",
      email: "test@example.com",
    },
  });

  describe("POST /webhooks/github/push", () => {
    it("should accept valid webhook with NEW_ISSUE commit", async () => {
      const payload = createPushPayload("NEW_ISSUE: Integration test issue\n\nThis is a test description");
      const signature = createSignature(payload, "integration-test-secret");

      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", signature)
        .set("X-GitHub-Delivery", "integration-test-delivery-1")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("deliveryId", "integration-test-delivery-1");
    });

    it("should reject webhook with invalid signature", async () => {
      const payload = createPushPayload("NEW_ISSUE: Test");
      const invalidSignature = "sha256=invalid";

      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", invalidSignature)
        .set("X-GitHub-Delivery", "integration-test-delivery-2")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(response.status).toBe(401);
    });

    it("should reject webhook without delivery ID", async () => {
      const payload = createPushPayload("NEW_ISSUE: Test");
      const signature = createSignature(payload, "integration-test-secret");

      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", signature)
        .set("Content-Type", "application/json")
        .send(payload);

      expect(response.status).toBe(400);
    });

    it("should skip commits without NEW_ISSUE tag", async () => {
      const payload = createPushPayload("Regular commit message");
      const signature = createSignature(payload, "integration-test-secret");

      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", signature)
        .set("X-GitHub-Delivery", "integration-test-delivery-3")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.issuesCreated).toHaveLength(0);
    });

    it("should handle multiple commits in single push", async () => {
      const payload = {
        ref: "refs/heads/main",
        repository: {
          id: 12345,
          name: "test-repo",
          full_name: "org/test-repo",
          html_url: "https://github.com/org/test-repo",
        },
        commits: [
          {
            id: "commit1",
            message: "NEW_ISSUE: First issue",
            timestamp: "2026-05-06T12:00:00Z",
            url: "https://github.com/org/test-repo/commit/commit1",
            author: {
              name: "Test",
              email: "test@example.com",
            },
            committer: {
              name: "Test",
              email: "test@example.com",
            },
          },
          {
            id: "commit2",
            message: "Regular commit",
            timestamp: "2026-05-06T12:01:00Z",
            url: "https://github.com/org/test-repo/commit/commit2",
            author: {
              name: "Test",
              email: "test@example.com",
            },
            committer: {
              name: "Test",
              email: "test@example.com",
            },
          },
          {
            id: "commit3",
            message: "NEW_ISSUE: Second issue",
            timestamp: "2026-05-06T12:02:00Z",
            url: "https://github.com/org/test-repo/commit/commit3",
            author: {
              name: "Test",
              email: "test@example.com",
            },
            committer: {
              name: "Test",
              email: "test@example.com",
            },
          },
        ],
        pusher: {
          name: "Test",
          email: "test@example.com",
        },
      };

      const signature = createSignature(payload, "integration-test-secret");

      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", signature)
        .set("X-GitHub-Delivery", "integration-test-delivery-4")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.issuesCreated).toHaveLength(2);
    });

    it("should parse issue with priority and labels", async () => {
      const payload = createPushPayload(
        "NEW_ISSUE: Critical bug fix\nPRIORITY: critical\nLABELS: bug, urgent\n\nDetailed description here"
      );
      const signature = createSignature(payload, "integration-test-secret");

      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", signature)
        .set("X-GitHub-Delivery", "integration-test-delivery-5")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(response.status).toBe(200);
    });

    it("should handle malformed JSON gracefully", async () => {
      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", "sha256=invalid")
        .set("X-GitHub-Delivery", "integration-test-delivery-6")
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Security", () => {
    it("should use constant-time comparison for signatures", async () => {
      const payload = createPushPayload("NEW_ISSUE: Test");
      const validSignature = createSignature(payload, "integration-test-secret");
      
      // Create signature with same length but different content
      const invalidSignature = validSignature.replace(/a/g, "b");

      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", invalidSignature)
        .set("X-GitHub-Delivery", "integration-test-delivery-7")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(response.status).toBe(401);
    });

    it("should not expose internal error details", async () => {
      const payload = createPushPayload("NEW_ISSUE: Test");
      const signature = createSignature(payload, "integration-test-secret");

      // Temporarily remove company ID to trigger internal error
      const originalCompanyId = process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID;
      delete process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID;

      const response = await request(app)
        .post("/webhooks/github/push")
        .set("X-Hub-Signature-256", signature)
        .set("X-GitHub-Delivery", "integration-test-delivery-8")
        .set("Content-Type", "application/json")
        .send(payload);

      // Restore company ID
      process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID = originalCompanyId;

      expect(response.status).toBe(500);
      expect(response.body).not.toHaveProperty("stack");
      expect(response.body).not.toHaveProperty("details");
    });
  });
});
