import { Router } from 'express';
import mongoose from 'mongoose';
import { Badge } from '../models/Badge.js';
import { User } from '../models/User.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/httpError.js';
import { canGiveBadge, canRemoveBadge, memberTeams } from '../utils/access.js';
import { inBackground, notifyBadge } from '../services/notify.js';

/*
 * Scout badges. The Group Leader and Helpers give them to anyone, a Kadr Leader to members of their
 * own kadr. A member sees their own on the Profile page; their badges also show in the member details
 * for everyone who can open them (the Members page).
 */
const router = Router();

// Offered while typing a badge (any word can be used).
const SUGGESTIONS = ['Leadership', 'Teamwork', 'Creativity', 'Service', 'Punctuality', 'First aid', 'Camping', 'Helpfulness'];

const populate = (q) => q.populate('givenBy', 'name').sort({ givenAt: -1 });
const forClient = (badges, user) => badges.map((b) => ({ ...b.toJSON(), canRemove: canRemoveBadge(user, b) }));

/** The member whose badges `user` may see: themselves, or someone they can view on the Members page. */
async function visibleMember(user, id) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Member not found');
  if (user._id.equals(id)) return user;
  const member = await User.findById(id);
  if (!member || !memberTeams(user).includes(member.team)) throw notFound('Member not found');
  return member;
}

// GET /api/badges/mine
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    res.json({ badges: forClient(await populate(Badge.find({ user: req.user._id })), req.user) });
  })
);

// GET /api/badges/counts -> { userId: number } for the members this user can view (Members list).
router.get(
  '/counts',
  asyncHandler(async (req, res) => {
    const teams = memberTeams(req.user);
    if (!teams.length) return res.json({ counts: {} });
    const ids = await User.find({ team: { $in: teams } }).distinct('_id');
    const rows = await Badge.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]);
    res.json({ counts: Object.fromEntries(rows.map((r) => [String(r._id), r.n])) });
  })
);

// GET /api/badges/user/:id -> the member's badges, and whether this user can give one.
router.get(
  '/user/:id',
  asyncHandler(async (req, res) => {
    const member = await visibleMember(req.user, req.params.id);
    const badges = await populate(Badge.find({ user: member._id }));
    res.json({ badges: forClient(badges, req.user), canGive: canGiveBadge(req.user, member), suggestions: SUGGESTIONS });
  })
);

// POST /api/badges { user, title, reason? }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const member = await visibleMember(req.user, req.body.user);
    if (!canGiveBadge(req.user, member)) {
      throw forbidden("Only the Group Leader, Group Leader Helpers and this member's Kadr Leader can give badges");
    }
    const title = String(req.body.title || '').trim().replace(/\s+/g, ' ');
    const reason = String(req.body.reason || '').trim();
    if (!title) throw badRequest('Write the badge');
    if (title.length > 30) throw badRequest('A badge can be at most 30 characters');
    if (reason.length > 120) throw badRequest('The reason can be at most 120 characters');
    const badge = await Badge.create({ user: member._id, title, reason, givenBy: req.user._id });
    await badge.populate('givenBy', 'name');
    res.status(201).json({ badge: forClient([badge], req.user)[0] });
    inBackground(notifyBadge(badge, member, req.user));
  })
);

// DELETE /api/badges/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Badge not found');
    const badge = await Badge.findById(req.params.id);
    if (!badge) throw notFound('Badge not found');
    await visibleMember(req.user, badge.user);
    if (!canRemoveBadge(req.user, badge)) throw forbidden('Only the person who gave this badge, or the Group Leader and Helpers, can remove it');
    await badge.deleteOne();
    res.json({ ok: true });
  })
);

export default router;
