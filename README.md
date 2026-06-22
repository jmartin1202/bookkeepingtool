# Month-End Document Chaser

GitLab/GitHub-ready Next.js/Supabase scaffold for the bookkeeping document collection MVP.

The first production slice includes:

- the core database schema and `create_collection_cycle` RPC
- an authenticated cycle creation API route
- a public client upload portal at `/portal/[token]`
- signed uploads into a private Supabase Storage bucket
- GitLab CI and GitHub Actions for typecheck/lint/build verification

## Files

- `.gitlab-ci.yml` - GitLab pipeline for typecheck and build.
- `.github/workflows/ci.yml` - GitHub Actions pipeline for typecheck, lint, and build.
- `supabase/001_init.sql` - relational schema, RLS policies, private storage bucket, and atomic `create_collection_cycle` RPC.
- `src/app/api/collection-cycles/route.ts` - authenticated route for creating monthly collection cycles.
- `src/app/portal/[token]/page.tsx` - public upload portal page.
- `src/app/components/portal-upload-list.tsx` - client-side file upload workflow.
- `src/app/api/public-upload/sign/route.ts` - validates a public token and creates a signed upload URL.
- `src/app/api/public-upload/complete/route.ts` - records upload metadata and marks the document request as uploaded.
- `src/lib/supabase/admin.ts` - server-only service-role Supabase client.
- `src/lib/supabase/server.ts` - cookie-aware Supabase server client for authenticated routes.
- `src/lib/supabase/browser.ts` - browser Supabase client for signed uploads.

## Environment Variables

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
```

Later Stripe routes will also need:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY_35=price_...
```

## Required Packages

```bash
npm install
```

## Core API Request

```http
POST /api/collection-cycles
Content-Type: application/json
```

```json
{
  "clientId": "uuid",
  "templateId": "uuid",
  "periodMonth": "2026-06-01",
  "dueDate": "2026-06-10"
}
```

## API Response

```json
{
  "cycle": {
    "id": "uuid",
    "clientId": "uuid",
    "templateId": "uuid",
    "periodMonth": "2026-06-01",
    "dueDate": "2026-06-10",
    "status": "open",
    "publicToken": "secure-token",
    "uploadPath": "/portal/secure-token",
    "uploadUrl": "http://localhost:3000/portal/secure-token",
    "requestCount": 7
  }
}
```

## Public Upload Flow

1. Bookkeeper creates a cycle through `POST /api/collection-cycles`.
2. The response includes `uploadUrl`, such as `/portal/secure-token`.
3. Client opens the portal and sees the missing document list.
4. Client chooses a file and clicks upload.
5. Browser calls `POST /api/public-upload/sign`.
6. Browser uploads directly to Supabase Storage with the signed URL.
7. Browser calls `POST /api/public-upload/complete`.
8. The app records metadata and marks the document request as `uploaded`.

## GitLab Setup

```bash
git init
git add .
git commit -m "Initial Month-End Document Chaser scaffold"
git remote add origin git@gitlab.com:YOUR_NAMESPACE/month-end-document-chaser.git
git push -u origin main
```

Set the same environment variables in GitLab CI/CD settings and in your Vercel project.

## GitHub Setup

```bash
git init
git add .
git commit -m "Initial Month-End Document Chaser scaffold"
git remote add origin git@github.com:jmartin1202/bookkeepingtool.git
git push -u origin main
```

Set the same environment variables in GitHub Actions secrets and in your Vercel project.

## Local Verification

These checks pass in this scaffold:

```bash
npm run typecheck
npm run lint
npm run build
```

`npm audit` currently reports two moderate findings from Next.js' transitive `postcss` dependency. npm suggests `npm audit fix --force`, but that would downgrade Next.js to an old major version, so do not apply it blindly. Re-check after the next stable Next.js patch release.

## Why This Slice First

Do this before AI classification, SMS reminders, or QuickBooks integrations. If this works, the app can already create value: the bookkeeper can generate a monthly packet and send one link to the client.
