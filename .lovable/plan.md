## Workspace overhaul plan

The workspace area today has a list page, a detail shell with a side nav, and 12 tabs. The visual language is inconsistent with the rest of the app, the connection to chat / billing / credits is weak, and some tabs feel unfinished. This plan covers all three angles: **design**, **integration**, and **work flow**.

### 1. Design — list & detail

- **WorkspacesPage** (`/settings/workspaces`)
  - Replace the flat list rows with a richer card grid: avatar, plan badge, credits meter, member count, role chip, last activity.
  - Active workspace gets a distinct "Current" state with a soft gradient ring instead of a plain "Active" pill.
  - Quick actions on each card: Switch · Open · Invite · Settings.
  - Empty / first-run state for users with only Personal.
  - Header gains a small live credits summary across all workspaces.

- **WorkspaceDetailPage** (shell)
  - Sticky header keeps avatar/name/role but adds a credits bar with low-balance warning + a "Top up" button when `canBilling`.
  - Side nav: regroup into Workspace / Billing / Settings with subtle section dividers and an active rail in `primary`.
  - Mobile: drawer side nav with slide-in animation.

### 2. Integration — wire workspace into the rest of the app

- **Sidebar / Switcher**: `WorkspaceSwitcher` already exists but is disconnected from credits and plan. Add live credits chip, plan badge, "Manage" link, and a divider before Personal.
- **Chat**: when an active workspace is set, every new conversation / generation deducts from `workspaces.credits` instead of personal `credits`. Audit `useCredits` and the chat send path to honor `getActiveWorkspaceId()`.
- **Billing page**: surface a "Workspace billing" card when the active workspace is a team space, linking to `/settings/workspaces/:id/billing`.
- **Notifications**: surface workspace events (joined, low credits, invite accepted) through the existing `notifications` table.

### 3. Work — tab polish

- **OverviewTab**: KPI tiles (credits, members, monthly usage, active projects) + recent activity feed + quick invite.
- **MembersTab**: row-level role editor, monthly limit slider per member, presence dot from `workspace_member_status`.
- **InvitesTab**: pending list with resend / revoke, copy-link, email composer.
- **ActivityTab**: filterable audit log with icons per action type.
- **BillingTab**: current plan card, change-plan flow via `openWorkspaceCheckout`, top-up credits, invoices list.
- **UsageTab**: monthly chart (per member + total), per-tool breakdown.
- **GeneralTab**: name, avatar, slug, default member monthly limit.
- **BrandTab**: keep current brand kit editor, tighten layout.
- **NotificationsTab**: per-event toggles writing to `workspace_notification_prefs`.
- **SecurityTab**: 2FA-required toggle, SSO placeholder, audit-log export.
- **DataTab**: export workspace data, data-retention controls.
- **DangerTab**: archive, transfer ownership, delete (owner only, double-confirm).

### Technical notes

- No schema changes required — all tables in scope already exist (`workspaces`, `workspace_members`, `workspace_invites`, `workspace_audit_log`, `workspace_credit_topups`, `workspace_notification_prefs`, `workspace_settings`, `workspace_brand_kit`, `workspace_member_status`).
- Reuse existing hooks: `useWorkspaces`, `useWorkspaceContext`, `useWorkspaceMembers`, `useCredits`.
- Add a small `useWorkspaceCredits(workspaceId)` realtime hook for the header credits bar.
- All colors via semantic tokens (`primary`, `muted`, `destructive`, `card`, `border`). No raw hex.
- Animations via `framer-motion` (already installed): side-nav rail, card hover, drawer.

### Suggested order

1. Shell + side nav + WorkspacesPage redesign (foundation).
2. Switcher + chat credit routing (integration backbone).
3. Overview / Members / Invites / Billing tabs (most-used).
4. Activity / Usage / Notifications / Security / Data / Danger (polish).

This is a multi-step build. I'll work through it in the order above and ping you after each phase so you can react before I move on.
