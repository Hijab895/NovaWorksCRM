# NovaWorks CRM

NovaWorks CRM is a local role-based project and task management application. An administrator can turn finalized meeting transcripts into validated projects and assigned tasks using Gemini structured output. Managers see projects they manage, while agents see only their assigned tasks and related projects.

## Team

- Team member names: To be supplied

## Stack

- Frontend: React 19, Vite 8, JavaScript, and plain CSS
- Backend: Node.js 26, Express 5, JavaScript ES modules, and `express-session`
- Database: Node's built-in `node:sqlite` with a local SQLite file at `server/data/novaworks.sqlite`
- Authentication: scrypt password hashes and an HttpOnly session cookie
- AI: Google Gemini REST `generateContent` API with JSON structured output; configured model `gemini-3.5-flash-lite`
- Development proxy: Vite forwards `/api` to `http://localhost:3001`

## Local Setup

Prerequisite: Node.js 26 or newer with the built-in `node:sqlite` module.

From PowerShell:

```powershell
cd E:\NovaWorksCRM\server
npm.cmd install
Copy-Item .env.example .env

cd E:\NovaWorksCRM\client
npm.cmd install
```

Open `server/.env` and replace the placeholders. Do not commit this file.

```dotenv
SESSION_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=replace-with-your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

`SESSION_SECRET` protects local sessions. `GEMINI_API_KEY` authenticates Gemini requests. `GEMINI_MODEL` selects the structured-extraction model at request time.

## Seed Data

Seed the ten demo users from PowerShell. The command is idempotent and does not create projects or tasks.

```powershell
cd E:\NovaWorksCRM\server
npm.cmd run seed
```

All demo accounts use password `Demo123!`.

| ID | Name | Role | Email |
| --- | --- | --- | --- |
| ADMIN | Admin | ADMIN | admin@novaworks.example |
| PM01 | Ayesha Khan | MANAGER | ayesha@novaworks.example |
| PM02 | Bilal Ahmed | MANAGER | bilal@novaworks.example |
| PM03 | Hina Malik | MANAGER | hina@novaworks.example |
| DEV01 | Ali Raza | AGENT | ali@novaworks.example |
| DEV02 | Hamza Shah | AGENT | hamza@novaworks.example |
| DEV03 | Sara Noor | AGENT | sara@novaworks.example |
| DEV04 | Usman Tariq | AGENT | usman@novaworks.example |
| DEV05 | Zain Abbas | AGENT | zain@novaworks.example |
| DEV06 | Maryam Asif | AGENT | maryam@novaworks.example |

## Run Locally

Start the backend in the first PowerShell terminal:

```powershell
cd E:\NovaWorksCRM\server
npm.cmd run dev
```

Start the frontend in a second PowerShell terminal:

```powershell
cd E:\NovaWorksCRM\client
npm.cmd run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:3001`, and `GET /api/health` is public.

## Submission Demo

Use a fresh project/task dataset for this count-based demonstration. Seeding users alone leaves both tables empty; submitting the same transcript more than once can create duplicates.

1. Sign in as `admin@novaworks.example` with `Demo123!`.
2. Open **Create from Transcript**.
3. Paste the supplied meeting transcript exactly as provided.
4. Select **Create** once and wait for the success message.
5. Confirm the result reports 3 projects and 12 tasks.
6. Select **View Projects** and confirm three project cards are visible.
7. Open each project and verify that the task counts total 12 and that managers, assignees, dates, estimates, and final corrections match the meeting.

### Permission Checks

Sign out between accounts so each check uses a new session.

- Ayesha: sign in as `ayesha@novaworks.example`. Confirm she sees only projects managed by `PM01`, can read the team directory, and cannot access transcript creation.
- Ali: sign in as `ali@novaworks.example`. Confirm **My Tasks** contains only `DEV01` assignments. In UrbanCart, confirm Hamza's task is absent. Confirm inaccessible projects such as QuickServe do not reveal details.
- Hamza: sign in as `hamza@novaworks.example`. Confirm **My Tasks** contains only `DEV02` assignments and related project details exclude tasks assigned to other agents.

### Changed-Input Check

To prove the output is extracted rather than hardcoded, use a copy of the supplied meeting with a unique diagnostic project name and change one explicit final value, such as the final agreed estimate. Keep every required owner and date explicit. Submit once, then verify the saved project reflects the changed final value instead of the original value. This creates real local records; use a disposable local database for repeatable submission testing.

### Missing-Deadline Check

As admin, submit this transcript:

```text
Create project Missing Details Check for client Demo Client.
Ayesha Khan manages it, deadline 24 October 2026.
Ali Raza owns Build catalog UI. Estimated effort is 5 hours.
No task deadline has been agreed.
```

Expected result: `Correction required` with details identifying the missing task deadline. No project or task should be saved.

## Verified Features

- Seeded login with ADMIN, MANAGER, and AGENT roles
- HttpOnly, same-site session authentication with login, current-user, and logout APIs
- Role-restricted project, project-detail, task, and team reads
- Admin-only transcript extraction through Gemini structured output
- Validation of employee roles, required fields, calendar dates, positive hours, and task deadlines
- Atomic project/task persistence with rollback on insert failure
- Responsive project, task, team, login, and transcript-creation views
- Loading, empty, correction, provider-error, and success states

## Limitations

- Local SQLite persistence only; there is no hosted database or migration system.
- Sessions use in-memory storage and are lost when the backend restarts.
- The AI workflow creates projects and tasks only; there are no edit or delete screens.
- Resubmitting the same successful transcript can create duplicate projects and tasks.
- Gemini requests depend on external quota and model availability and can return temporary provider errors.
- The local session cookie uses `secure: false` for localhost and is not production deployment configuration.

## Checks

```powershell
cd E:\NovaWorksCRM\server
npm.cmd test
node --check src\index.js

cd E:\NovaWorksCRM\client
npm.cmd run build
npm.cmd run lint
```

The server also provides `npm.cmd run check:ai` for a live Gemini connectivity check. It consumes API quota and should not be run repeatedly.

## Deployment

- Status: Local only
- Demo video: To be supplied
- Repository: https://github.com/Hijab895/NovaWorksCRM
