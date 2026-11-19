import { and, count, desc, eq } from 'drizzle-orm';
import { Router, type Response } from 'express';
import { classifyDatabaseError, getDb } from '../../db/index.ts';
import {
  artistVerificationRequests,
  dmcaReports,
  emailAlerts,
  inviteCodes,
  posts,
  users,
} from '../../db/schema.ts';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireDatabase,
  type AuthRequest,
} from '../auth.ts';
import { dbRateLimit } from '../rateLimit.ts';
import {
  getAdminAlertEmail,
  isResendConfigured,
  sendResendAlert,
} from '../resend.ts';

const adminRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isValidHttpsUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET /api/artist-verification/me
adminRouter.get(
  '/artist-verification/me',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const db = getDb();
      const [latestRequest] = await db
        .select()
        .from(artistVerificationRequests)
        .where(eq(artistVerificationRequests.userId, req.authUser!.id))
        .orderBy(desc(artistVerificationRequests.createdAt))
        .limit(1);

      return res.json({
        isVerifiedArtist: req.authUser!.isVerifiedArtist,
        verifiedArtistName: req.authUser!.verifiedArtistName,
        latestRequest: latestRequest
          ? {
              ...latestRequest,
              createdAt: latestRequest.createdAt.toISOString(),
              reviewedAt: latestRequest.reviewedAt
                ? latestRequest.reviewedAt.toISOString()
                : null,
            }
          : null,
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// POST /api/artist-verification/request
adminRouter.post(
  '/artist-verification/request',
  requireDatabase,
  requireAuth,
  dbRateLimit({ action: 'artist_verification', maxRequests: 5, windowSeconds: 3600 }),
  async (req: AuthRequest, res: Response) => {
    if (req.authUser!.isVerifiedArtist) {
      return res.status(400).json({ error: 'Your account already holds a Verified Artist badge.' });
    }

    const { artistName, portfolioUrl, notes } = req.body ?? {};
    if (typeof artistName !== 'string' || artistName.trim().length < 2 || artistName.trim().length > 120) {
      return res.status(400).json({ error: 'Artist or project name (2–120 characters) is required.' });
    }
    if (!isValidHttpsUrl(portfolioUrl)) {
      return res.status(400).json({
        error: 'Provide a valid https:// official artist link (SoundCloud, YouTube, Bandcamp, or website).',
      });
    }

    try {
      const db = getDb();
      const [existingPending] = await db
        .select({ id: artistVerificationRequests.id })
        .from(artistVerificationRequests)
        .where(
          and(
            eq(artistVerificationRequests.userId, req.authUser!.id),
            eq(artistVerificationRequests.status, 'pending'),
          ),
        )
        .limit(1);

      if (existingPending) {
        return res.status(409).json({
          error: 'You already have a pending Verified Artist request under review.',
        });
      }

      const cleanArtistName = artistName.trim();
      const cleanPortfolioUrl = portfolioUrl.trim().slice(0, 400);
      const cleanNotes =
        typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 600) : null;

      const [created] = await db
        .insert(artistVerificationRequests)
        .values({
          userId: req.authUser!.id,
          artistName: cleanArtistName,
          portfolioUrl: cleanPortfolioUrl,
          notes: cleanNotes,
          status: 'pending',
        })
        .returning();

      const adminEmail = getAdminAlertEmail();
      if (adminEmail) {
        void sendResendAlert({
          to: adminEmail,
          alertType: 'artist_verification',
          subject: `[SONA Verification] New Verified Artist claim from @${req.authUser!.username}`,
          text: `Member @${req.authUser!.username} requested a Verified Artist badge as "${cleanArtistName}".\nOfficial URL: ${cleanPortfolioUrl}\nNotes: ${cleanNotes || 'None'}`,
        });
      }

      return res.status(201).json({
        request: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          reviewedAt: null,
        },
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// POST /api/dmca/report - File DMCA notice + trigger Resend email workflow
adminRouter.post(
  '/dmca/report',
  requireDatabase,
  optionalAuth,
  dbRateLimit({ action: 'dmca_report', maxRequests: 10, windowSeconds: 3600 }),
  async (req: AuthRequest, res: Response) => {
    const { postId, claimantName, reporterEmail, reason, rightsUrl } = req.body ?? {};
    if (typeof postId !== 'string' || !isValidUuid(postId)) {
      return res.status(400).json({ error: 'Valid postId is required.' });
    }
    if (typeof claimantName !== 'string' || claimantName.trim().length < 2) {
      return res.status(400).json({ error: 'Claimant or rights holder name is required.' });
    }
    if (typeof reporterEmail !== 'string' || !reporterEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid contact email address is required.' });
    }
    if (typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({
        error: 'Please provide at least 10 characters explaining the copyright claim.',
      });
    }
    if (rightsUrl && !isValidHttpsUrl(rightsUrl)) {
      return res.status(400).json({ error: 'Reference rights URL must begin with https://' });
    }

    try {
      const db = getDb();
      const [targetPost] = await db
        .select({
          id: posts.id,
          title: posts.title,
          mediaUrl: posts.mediaUrl,
          authorEmail: users.email,
          authorUsername: users.username,
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .where(eq(posts.id, postId))
        .limit(1);

      if (!targetPost) {
        return res.status(404).json({ error: 'Target track post not found.' });
      }

      const [created] = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(dmcaReports)
          .values({
            postId,
            reporterUserId: req.authUser?.id ?? null,
            reporterEmail: reporterEmail.trim().toLowerCase().slice(0, 255),
            claimantName: claimantName.trim().slice(0, 120),
            reason: reason.trim().slice(0, 2000),
            rightsUrl: rightsUrl ? rightsUrl.trim().slice(0, 400) : null,
            status: 'open',
          })
          .returning();

        // Safe-harbor interim hide pending admin review
        await tx.update(posts).set({ isHidden: true }).where(eq(posts.id, postId));
        return inserted;
      });

      const alertPromises = [];
      const adminEmail = getAdminAlertEmail();
      if (adminEmail) {
        alertPromises.push(
          sendResendAlert({
            to: adminEmail,
            alertType: 'dmca_notice',
            subject: `[SONA DMCA Notice] Takedown claim on "${targetPost.title || targetPost.id}"`,
            text: `Claimant: ${created.claimantName} (${created.reporterEmail})\nTrack: ${targetPost.title || 'Untitled'} (${targetPost.mediaUrl})\nCurator: @${targetPost.authorUsername}\nReason: ${created.reason}\n\nThe post has been automatically hidden pending Admin Dashboard review.`,
          }),
        );
      }
      if (targetPost.authorEmail) {
        alertPromises.push(
          sendResendAlert({
            to: targetPost.authorEmail,
            alertType: 'dmca_notice',
            subject: `SONA Notice: Track "${targetPost.title || 'Untitled'}" temporarily hidden for review`,
            text: `Hi @${targetPost.authorUsername},\n\nA copyright/DMCA report was submitted by ${created.claimantName} regarding your shared track "${targetPost.title || 'Untitled'}" (${targetPost.mediaUrl}).\n\nIt has been temporarily hidden from the public feed while a SONA admin reviews the notice.`,
          }),
        );
      }

      const alertResults = await Promise.all(alertPromises);

      return res.status(201).json({
        report: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          resolvedAt: null,
        },
        alertResults,
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// GET /api/admin/overview - Full Admin Dashboard telemetry & queues
adminRouter.get(
  '/admin/overview',
  requireDatabase,
  requireAuth,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const db = getDb();

      const [
        [{ usersCount }],
        [{ postsCount }],
        [{ flaggedPostsCount }],
        [{ verifiedArtistsCount }],
        [{ openDmcaCount }],
        [{ pendingVerificationsCount }],
      ] = await Promise.all([
        db.select({ usersCount: count() }).from(users),
        db.select({ postsCount: count() }).from(posts),
        db.select({ flaggedPostsCount: count() }).from(posts).where(eq(posts.isHidden, true)),
        db.select({ verifiedArtistsCount: count() }).from(users).where(eq(users.isVerifiedArtist, true)),
        db.select({ openDmcaCount: count() }).from(dmcaReports).where(eq(dmcaReports.status, 'open')),
        db
          .select({ pendingVerificationsCount: count() })
          .from(artistVerificationRequests)
          .where(eq(artistVerificationRequests.status, 'pending')),
      ]);

      const flaggedPosts = await db
        .select({
          id: posts.id,
          title: posts.title,
          artistName: posts.artistName,
          mediaUrl: posts.mediaUrl,
          isHidden: posts.isHidden,
          createdAt: posts.createdAt,
          authorUsername: users.username,
          authorIsVerifiedArtist: users.isVerifiedArtist,
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .where(eq(posts.isHidden, true))
        .orderBy(desc(posts.createdAt))
        .limit(40);

      const dmcaList = await db
        .select({
          id: dmcaReports.id,
          postId: dmcaReports.postId,
          claimantName: dmcaReports.claimantName,
          reporterEmail: dmcaReports.reporterEmail,
          reason: dmcaReports.reason,
          rightsUrl: dmcaReports.rightsUrl,
          status: dmcaReports.status,
          createdAt: dmcaReports.createdAt,
          resolvedAt: dmcaReports.resolvedAt,
          postTitle: posts.title,
          postMediaUrl: posts.mediaUrl,
          postIsHidden: posts.isHidden,
        })
        .from(dmcaReports)
        .leftJoin(posts, eq(dmcaReports.postId, posts.id))
        .orderBy(desc(dmcaReports.createdAt))
        .limit(40);

      const verifications = await db
        .select({
          id: artistVerificationRequests.id,
          userId: artistVerificationRequests.userId,
          artistName: artistVerificationRequests.artistName,
          portfolioUrl: artistVerificationRequests.portfolioUrl,
          notes: artistVerificationRequests.notes,
          status: artistVerificationRequests.status,
          createdAt: artistVerificationRequests.createdAt,
          reviewedAt: artistVerificationRequests.reviewedAt,
          username: users.username,
          email: users.email,
        })
        .from(artistVerificationRequests)
        .innerJoin(users, eq(artistVerificationRequests.userId, users.id))
        .orderBy(desc(artistVerificationRequests.createdAt))
        .limit(40);

      const members = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          isVerifiedArtist: users.isVerifiedArtist,
          verifiedArtistName: users.verifiedArtistName,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(100);

      const invites = await db
        .select({
          code: inviteCodes.code,
          createdBy: inviteCodes.createdBy,
          usedBy: inviteCodes.usedBy,
          createdAt: inviteCodes.createdAt,
        })
        .from(inviteCodes)
        .orderBy(desc(inviteCodes.createdAt))
        .limit(50);

      const alerts = await db
        .select()
        .from(emailAlerts)
        .orderBy(desc(emailAlerts.createdAt))
        .limit(40);

      return res.json({
        stats: {
          usersCount: Number(usersCount ?? 0),
          postsCount: Number(postsCount ?? 0),
          flaggedPostsCount: Number(flaggedPostsCount ?? 0),
          verifiedArtistsCount: Number(verifiedArtistsCount ?? 0),
          openDmcaCount: Number(openDmcaCount ?? 0),
          pendingVerificationsCount: Number(pendingVerificationsCount ?? 0),
        },
        resendConfigured: isResendConfigured(),
        adminAlertEmail: getAdminAlertEmail(),
        flaggedPosts: flaggedPosts.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        })),
        dmcaReports: dmcaList.map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
          resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
        })),
        verificationRequests: verifications.map((v) => ({
          ...v,
          createdAt: v.createdAt.toISOString(),
          reviewedAt: v.reviewedAt ? v.reviewedAt.toISOString() : null,
        })),
        members: members.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
        invites: invites.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
        })),
        emailAlerts: alerts.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// PATCH /api/admin/verifications/:id - Approve or reject Verified Artist claim
adminRouter.patch(
  '/admin/verifications/:id',
  requireDatabase,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body ?? {};
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid verification request identifier.' });
    }
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected".' });
    }

    try {
      const db = getDb();
      const updated = await db.transaction(async (tx) => {
        const [reqRow] = await tx
          .select()
          .from(artistVerificationRequests)
          .where(eq(artistVerificationRequests.id, id))
          .limit(1);

        if (!reqRow) return null;

        const [savedReq] = await tx
          .update(artistVerificationRequests)
          .set({
            status,
            reviewedBy: req.authUser!.id,
            reviewedAt: new Date(),
          })
          .where(eq(artistVerificationRequests.id, id))
          .returning();

        if (status === 'approved') {
          await tx
            .update(users)
            .set({
              isVerifiedArtist: true,
              verifiedArtistName: reqRow.artistName,
              verifiedAt: new Date(),
            })
            .where(eq(users.id, reqRow.userId));
        }

        const [targetUser] = await tx
          .select({ email: users.email, username: users.username })
          .from(users)
          .where(eq(users.id, reqRow.userId))
          .limit(1);

        return { savedReq, targetUser };
      });

      if (!updated) {
        return res.status(404).json({ error: 'Verification request not found.' });
      }

      if (updated.targetUser?.email) {
        await sendResendAlert({
          to: updated.targetUser.email,
          alertType: 'artist_verification',
          subject:
            status === 'approved'
              ? `You are now a Verified Artist on SONA (${updated.savedReq.artistName})`
              : 'Update on your SONA Verified Artist request',
          text:
            status === 'approved'
              ? `Hi @${updated.targetUser.username},\n\nCongratulations — your Verified Artist claim for "${updated.savedReq.artistName}" has been approved! Your Verified Artist badge is now visible across the SONA Discovery Feed, crates, and comments.`
              : `Hi @${updated.targetUser.username},\n\nYour Verified Artist request for "${updated.savedReq.artistName}" could not be verified with the submitted link. You can submit an updated request from Settings at any time.`,
        });
      }

      return res.json({
        request: {
          ...updated.savedReq,
          createdAt: updated.savedReq.createdAt.toISOString(),
          reviewedAt: updated.savedReq.reviewedAt
            ? updated.savedReq.reviewedAt.toISOString()
            : null,
        },
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// PATCH /api/admin/users/:id/verified - Directly toggle Verified Artist badge
adminRouter.patch(
  '/admin/users/:id/verified',
  requireDatabase,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { isVerifiedArtist, verifiedArtistName } = req.body ?? {};
    if (typeof isVerifiedArtist !== 'boolean') {
      return res.status(400).json({ error: 'Boolean isVerifiedArtist is required.' });
    }

    try {
      const db = getDb();
      const cleanName =
        typeof verifiedArtistName === 'string' && verifiedArtistName.trim()
          ? verifiedArtistName.trim().slice(0, 120)
          : null;

      const [updated] = await db
        .update(users)
        .set({
          isVerifiedArtist,
          verifiedArtistName: isVerifiedArtist ? cleanName : null,
          verifiedAt: isVerifiedArtist ? new Date() : null,
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          isVerifiedArtist: users.isVerifiedArtist,
          verifiedArtistName: users.verifiedArtistName,
        });

      if (!updated) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (isVerifiedArtist && updated.email) {
        await sendResendAlert({
          to: updated.email,
          alertType: 'artist_verification',
          subject: `Verified Artist badge granted on SONA`,
          text: `Hi @${updated.username},\n\nA SONA administrator granted your account the Verified Artist badge${updated.verifiedArtistName ? ` (${updated.verifiedArtistName})` : ''}.`,
        });
      }

      return res.json({ user: updated });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// PATCH /api/admin/users/:id/role - Promote or demote user role
adminRouter.patch(
  '/admin/users/:id/role',
  requireDatabase,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { role } = req.body ?? {};
    if (role !== 'user' && role !== 'admin') {
      return res.status(400).json({ error: 'Role must be "user" or "admin".' });
    }

    try {
      const db = getDb();
      if (id === req.authUser!.id && role !== 'admin') {
        const [{ adminCount }] = await db
          .select({ adminCount: count() })
          .from(users)
          .where(eq(users.role, 'admin'));
        if (Number(adminCount) <= 1) {
          return res.status(400).json({
            error: 'Cannot remove admin privileges from the sole remaining administrator.',
          });
        }
      }

      const [updated] = await db
        .update(users)
        .set({ role })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          isVerifiedArtist: users.isVerifiedArtist,
          verifiedArtistName: users.verifiedArtistName,
        });

      if (!updated) {
        return res.status(404).json({ error: 'User not found.' });
      }
      return res.json({ user: updated });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// PATCH /api/admin/dmca/:id - Resolve DMCA notice & dispatch Resend resolution alerts
adminRouter.patch(
  '/admin/dmca/:id',
  requireDatabase,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status, restorePost } = req.body ?? {};
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid DMCA report identifier.' });
    }
    if (status !== 'takedown_applied' && status !== 'dismissed') {
      return res.status(400).json({
        error: 'Status must be "takedown_applied" or "dismissed".',
      });
    }

    try {
      const db = getDb();
      const result = await db.transaction(async (tx) => {
        const [report] = await tx
          .select()
          .from(dmcaReports)
          .where(eq(dmcaReports.id, id))
          .limit(1);
        if (!report) return null;

        const [updated] = await tx
          .update(dmcaReports)
          .set({
            status,
            resolvedBy: req.authUser!.id,
            resolvedAt: new Date(),
          })
          .where(eq(dmcaReports.id, id))
          .returning();

        let targetPost: { title: string | null; authorEmail: string | null } | null = null;
        if (report.postId) {
          const [postRow] = await tx
            .select({
              id: posts.id,
              title: posts.title,
              authorEmail: users.email,
            })
            .from(posts)
            .innerJoin(users, eq(posts.userId, users.id))
            .where(eq(posts.id, report.postId))
            .limit(1);
          targetPost = postRow ?? null;

          if (status === 'takedown_applied') {
            await tx
              .update(posts)
              .set({ isHidden: true })
              .where(eq(posts.id, report.postId));
          } else if (status === 'dismissed' && restorePost === true) {
            await tx
              .update(posts)
              .set({ isHidden: false })
              .where(eq(posts.id, report.postId));
          }
        }

        return { updated, targetPost };
      });

      if (!result) {
        return res.status(404).json({ error: 'DMCA report not found.' });
      }

      const trackLabel = result.targetPost?.title || 'reported track';
      await sendResendAlert({
        to: result.updated.reporterEmail,
        alertType: 'dmca_resolution',
        subject:
          status === 'takedown_applied'
            ? `SONA DMCA Update: Takedown applied for "${trackLabel}"`
            : `SONA DMCA Update: Claim reviewed for "${trackLabel}"`,
        text:
          status === 'takedown_applied'
            ? `Hello ${result.updated.claimantName},\n\nYour DMCA notice regarding "${trackLabel}" has been reviewed and upheld. The track remains removed from the public SONA feed.`
            : `Hello ${result.updated.claimantName},\n\nYour DMCA notice regarding "${trackLabel}" has been reviewed and dismissed by SONA moderation.`,
      });

      if (result.targetPost?.authorEmail) {
        await sendResendAlert({
          to: result.targetPost.authorEmail,
          alertType: 'dmca_resolution',
          subject: `SONA Moderation Resolution: "${trackLabel}"`,
          text:
            status === 'takedown_applied'
              ? `Your shared track "${trackLabel}" has been kept hidden following a DMCA takedown resolution.`
              : `Review complete: the DMCA claim against "${trackLabel}" was dismissed${restorePost ? ' and your track has been restored to the feed' : ''}.`,
        });
      }

      return res.json({
        report: {
          ...result.updated,
          createdAt: result.updated.createdAt.toISOString(),
          resolvedAt: result.updated.resolvedAt
            ? result.updated.resolvedAt.toISOString()
            : null,
        },
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// POST /api/admin/alerts/send - Admin manual/test alert via Resend workflow
adminRouter.post(
  '/admin/alerts/send',
  requireDatabase,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const { to, subject, text } = req.body ?? {};
    if (typeof to !== 'string' || !to.includes('@')) {
      return res.status(400).json({ error: 'A valid recipient email address is required.' });
    }
    if (typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ error: 'Email subject is required.' });
    }
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Email message body is required.' });
    }

    const result = await sendResendAlert({
      to: to.trim(),
      alertType: 'admin_broadcast',
      subject: subject.trim().slice(0, 200),
      text: text.trim().slice(0, 4000),
    });

    return res.status(result.deliveryStatus === 'failed' ? 502 : 200).json(result);
  },
);

export default adminRouter;
