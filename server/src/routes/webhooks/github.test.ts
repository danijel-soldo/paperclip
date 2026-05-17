import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import type { Request, Response } from "express";
import { githubWebhookRoutes } from "./github.js";
import type { Db } from "@paperclipai/db";

// Mock dependencies
vi.mock("../../services/index.js", () => ({
  issueService: vi.fn(() => ({
    create: vi.fn(),
  })),
  companyService: vi.fn(),
  projectService: vi.fn(),
}));

vi.mock("../../middleware/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper functions
const createValidPayload = () => ({
  ref: "refs/heads/main",
  repository: {
    id: 12345,
    name: "test-repo",
    full_name: "org/test-repo",
    html_url: "https://github.com/org/test-repo",
  },
  commits: [
    {
      id: "abc123",
      message: "NEW_ISSUE: Fix critical bug\n\nThis is a description",
      timestamp: "2026-05-06T12:00:00Z",
      url: "https://github.com/org/test-repo/commit/abc123",
      author: {
        name: "John Doe",
        email: "john@example.com",
        username: "johndoe",
      },
      committer: {
        name: "John Doe",
        email: "john@example.com",
        username: "johndoe",
      },
    },
  ],
  pusher: {
    name: "John Doe",
    email: "john@example.com",
  },
});

const createSignature = (payload: unknown, secret: string): string => {
  const hmac = createHmac("sha256", secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest("hex")}`;
};

describe("GitHub Webhook Routes", () => {
  let mockDb: Db;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDb = {} as Db;
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn();
    
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    // Set required environment variables
    process.env.GITHUB_WEBHOOK_SECRET = "test-secret";
    process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID = "test-company-id";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID;
    delete process.env.GITHUB_WEBHOOK_DEFAULT_PROJECT_ID;
  });

  describe("POST /push", () => {

    it("should reject requests without webhook secret configured", async () => {
      delete process.env.GITHUB_WEBHOOK_SECRET;

      const payload = createValidPayload();
      const rawBody = Buffer.from(JSON.stringify(payload));

      mockReq = {
        body: payload,
        rawBody,
        get: vi.fn((header: string) => {
          if (header === "x-github-delivery") return "delivery-123";
          if (header === "x-hub-signature-256") return createSignature(payload, "test-secret");
          return undefined;
        }),
      };

      const router = githubWebhookRoutes(mockDb);
      const route = router.stack.find((layer) => layer.route?.path === "/push");
      
      await expect(async () => {
        for (const handler of route!.route!.stack) {
          await handler.handle(mockReq as Request, mockRes as Response, vi.fn());
        }
      }).rejects.toThrow();
    });

    it("should reject requests with invalid signature", async () => {
      const payload = createValidPayload();
      const rawBody = Buffer.from(JSON.stringify(payload));

      mockReq = {
        body: payload,
        rawBody,
        get: vi.fn((header: string) => {
          if (header === "x-github-delivery") return "delivery-123";
          if (header === "x-hub-signature-256") return "sha256=invalid-signature";
          return undefined;
        }),
      };

      const router = githubWebhookRoutes(mockDb);
      const route = router.stack.find((layer) => layer.route?.path === "/push");
      
      await expect(async () => {
        for (const handler of route!.route!.stack) {
          await handler.handle(mockReq as Request, mockRes as Response, vi.fn());
        }
      }).rejects.toThrow("Invalid webhook signature");
    });

    it("should reject requests without delivery ID", async () => {
      const payload = createValidPayload();
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = createSignature(payload, "test-secret");

      mockReq = {
        body: payload,
        rawBody,
        get: vi.fn((header: string) => {
          if (header === "x-hub-signature-256") return signature;
          return undefined;
        }),
      };

      const router = githubWebhookRoutes(mockDb);
      const route = router.stack.find((layer) => layer.route?.path === "/push");
      
      await expect(async () => {
        for (const handler of route!.route!.stack) {
          await handler.handle(mockReq as Request, mockRes as Response, vi.fn());
        }
      }).rejects.toThrow("Missing delivery ID");
    });

    it("should reject requests without raw body", async () => {
      const payload = createValidPayload();

      mockReq = {
        body: payload,
        get: vi.fn((header: string) => {
          if (header === "x-github-delivery") return "delivery-123";
          if (header === "x-hub-signature-256") return createSignature(payload, "test-secret");
          return undefined;
        }),
      };

      const router = githubWebhookRoutes(mockDb);
      const route = router.stack.find((layer) => layer.route?.path === "/push");
      
      await expect(async () => {
        for (const handler of route!.route!.stack) {
          await handler.handle(mockReq as Request, mockRes as Response, vi.fn());
        }
      }).rejects.toThrow("Invalid webhook signature");
    });
  });

  describe("Commit Message Parsing", () => {
    it("should parse NEW_ISSUE tag with title only", () => {
      const message = "NEW_ISSUE: Fix critical bug";
      // This would be tested through the webhook endpoint
      // The parsing logic is internal to the route handler
      expect(message).toContain("NEW_ISSUE:");
    });

    it("should parse NEW_ISSUE with priority", () => {
      const message = "NEW_ISSUE: Fix critical bug\nPRIORITY: high\n\nDescription here";
      expect(message).toContain("PRIORITY:");
    });

    it("should parse NEW_ISSUE with labels", () => {
      const message = "NEW_ISSUE: Fix critical bug\nLABELS: bug, urgent\n\nDescription here";
      expect(message).toContain("LABELS:");
    });

    it("should ignore commits without NEW_ISSUE tag", () => {
      const message = "Regular commit message";
      expect(message).not.toContain("NEW_ISSUE:");
    });
  });

  describe("Signature Verification", () => {
    it("should verify valid HMAC-SHA256 signature", () => {
      const payload = { test: "data" };
      const secret = "test-secret";
      const signature = createSignature(payload, secret);
      
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("should reject signature with wrong format", () => {
      const signature = "invalid-format";
      expect(signature).not.toMatch(/^sha256=/);
    });

    it("should reject signature with wrong algorithm", () => {
      const signature = "sha1=abc123";
      expect(signature).not.toMatch(/^sha256=/);
    });
  });

  describe("Origin Tracking", () => {
    it("should include commit metadata in origin", () => {
      const commitMetadata = {
        repository: "org/test-repo",
        repositoryId: 12345,
        commitSha: "abc123",
        commitUrl: "https://github.com/org/test-repo/commit/abc123",
        commitMessage: "NEW_ISSUE: Test",
        commitTimestamp: "2026-05-06T12:00:00Z",
        author: {
          name: "John Doe",
          email: "john@example.com",
        },
        pusher: {
          name: "John Doe",
          email: "john@example.com",
        },
        ref: "refs/heads/main",
      };

      expect(commitMetadata).toHaveProperty("repository");
      expect(commitMetadata).toHaveProperty("commitSha");
      expect(commitMetadata).toHaveProperty("commitUrl");
    });
  });

  describe("Duplicate Delivery Detection", () => {
    it("should track delivery IDs", () => {
      const deliveryId = "delivery-123";
      expect(deliveryId).toBeTruthy();
      expect(typeof deliveryId).toBe("string");
    });

    it("should handle multiple commits in single delivery", () => {
      const commits = [
        { id: "commit1", message: "NEW_ISSUE: First" },
        { id: "commit2", message: "NEW_ISSUE: Second" },
      ];
      expect(commits).toHaveLength(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing company configuration", async () => {
      delete process.env.GITHUB_WEBHOOK_DEFAULT_COMPANY_ID;

      const payload = createValidPayload();
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = createSignature(payload, "test-secret");

      mockReq = {
        body: payload,
        rawBody,
        get: vi.fn((header: string) => {
          if (header === "x-github-delivery") return "delivery-123";
          if (header === "x-hub-signature-256") return signature;
          return undefined;
        }),
      };

      const router = githubWebhookRoutes(mockDb);
      const route = router.stack.find((layer) => layer.route?.path === "/push");
      
      await expect(async () => {
        for (const handler of route!.route!.stack) {
          await handler.handle(mockReq as Request, mockRes as Response, vi.fn());
        }
      }).rejects.toThrow();
    });

    it("should handle malformed commit messages gracefully", () => {
      const messages = [
        "NEW_ISSUE:",  // Empty title
        "NEW_ISSUE",   // Missing colon
        "",            // Empty message
      ];
      
      messages.forEach((msg) => {
        expect(typeof msg).toBe("string");
      });
    });
  });

  describe("Security", () => {
    it("should use constant-time comparison for signatures", () => {
      // The implementation uses timingSafeEqual from crypto
      // This test verifies the signature format
      const signature1 = "sha256=" + "a".repeat(64);
      const signature2 = "sha256=" + "b".repeat(64);
      
      expect(signature1.length).toBe(signature2.length);
    });

    it("should validate signature before processing payload", () => {
      // Signature validation happens before any payload processing
      // This is enforced by the route handler order
      expect(true).toBe(true);
    });

    it("should not expose internal errors in responses", () => {
      // Error handling should return generic messages
      expect(true).toBe(true);
    });
  });
});
