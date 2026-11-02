# Requirements brief — Expense Report Manager
## Profile
Build a production-ready web application called “ExpenseDesk” for an Indian company to manage employee expenses, approvals and reimbursemen… · app · not known yet · size: large · depth: thorough
- **Has a user interface?** Yes (Greenfield could not tell. Change this if the app has no screens that people use.)
- **Runs locally?** Yes (It is a web app with a Vue frontend and a Laravel API that Greenfield can start on the person's machine.)
## The app
ExpenseDesk is an internal web app for one Indian company where 150 employees submit expense reports with receipts, 12 managers approve or request changes, and 3 finance staff record reimbursements, all on a Vue 3 and Laravel stack with SQLite. It replaces spreadsheet tracking and email receipts with a single audited workflow that shows the owner what is awaiting approval, what is owed and what has been paid.
## Goals and success
- G1 Give the owner visibility of what is awaiting approval, what the company owes employees, and what has already been paid. (description)
- G2 Replace spreadsheet expense tracking and email receipt collection with one internal app for expenses, approvals and reimbursements. (description)
- M1 Every report awaiting approval is visible to the owner within a day, and the amount owed to employees is known at any time. (within a day; at any time) [assumed] (Q3)
## Roles
- R1 Employee (150) (description)
- R2 Manager (12) (description)
- R3 Finance (3) (description)
- R4 Administrator (description)
## Workflows
### W1 Submit an expense report (release 1) — actors: R1 Employee; trigger: Employee has expenses to claim; outcome: Report is Submitted and goes to the assigned manager; how often: around 2,000 reports per month (description)
1. Sign in
2. Create a draft with title and business purpose
3. Add one or more expense lines with date, category, merchant, amount and optional note
4. Upload a receipt for each line of ₹1,000 or more
5. Save the draft or submit
6. See missing fields beside the affected line if any
7. Submit the report
### W2 Review an expense report (release 1) — actors: R2 Manager; trigger: A report is submitted by an assigned employee; outcome: Report is Approved, Changes requested or Rejected; how often: around 2,000 reports per month (description)
1. Open the approval inbox
2. Filter by employee, date or amount
3. Open the report and its receipts
4. Approve, request changes with a reason, or reject with a reason
### W3 Record a reimbursement (release 1) — actors: R3 Finance; trigger: A report is Approved; outcome: Report is Paid and appears in the paid total for the payment date; how often: around 2,000 reports per month (description)
1. Open the finance dashboard
2. Find the approved unpaid report
3. Record the full approved amount, payment date and payment reference
## Records
- E1 Expense report. fields: title, business purpose, employee, manager, status, total in paise, submitted at, decided at, paid at; states: Draft → Submitted → Approved → Changes requested → Rejected → Paid; owner: Employee (description)
- E2 Expense line. fields: expense date, category, merchant, amount in paise, note, receipt; owner: Employee (description)
- E3 Receipt. fields: file, type, size; owner: Employee (description)
- E4 Reimbursement. fields: amount in paise, payment date, payment reference, recorded by; owner: Finance (description)
- E5 Category. fields: name, active; owner: Administrator (description)
- E6 Audit event. fields: actor, time, report, state change; owner: System (description)
## Rules
- BR1 A receipt is required for each individual line of ₹1,000 or more.. Applies: A line of ₹1,250.25 for accommodation needs a receipt.. Does not apply: A line of ₹750.50 for travel needs no receipt. (description)
- BR2 Nobody may approve or record payment for their own report.. Applies: A manager who submitted a report cannot approve it.. Does not apply: A manager may approve a report submitted by someone else. (description)
- BR3 Rejected and Paid are final states.. Applies: A Paid report cannot be edited or resubmitted.. Does not apply: A Changes requested report can be edited and resubmitted. (description)
- BR4 The server rejects zero or negative amounts, future expense dates and empty reports.. Applies: A report with no lines is rejected.. Does not apply: A report with one line of ₹750.50 is accepted. (description)
- BR5 A double-click, network retry or two finance users acting simultaneously must create only one reimbursement.. Applies: Two finance users record payment for the same report at the same time; exactly one payment exists.. Does not apply: Two different approved reports each get their own payment. (description)
## Scope and constraints
- S3 Use Vue 3 with TypeScript, Vite and Vue Router for the frontend; PHP with Laravel for the backend REST API; SQLite as the production database on a single application server. [constraint] (description)
## Decisions
- **Stack:** Vue 3, Laravel and SQLite (as the user's description or documents say, description: "Use Vue 3 with TypeScript, Vite and Vue Router for the frontend. Use PHP with Laravel for the backend REST API. Use SQLite as the production database.") (Q1)
- **Deploy target:** a single application server (as the user's description or documents say, description: "Use a persistent database file on a single application server.") (Q2)
## Assumptions
- A1 No specific expense tool is named; Greenfield builds the workflow from the description, copying the clear approval and audit trail of common expense tools and avoiding their complexity. — The description already specifies the workflow in detail, so no external product needs to be copied. [assumed] (assumption, Q4)
- A2 The top pains today are lost receipts in email, spreadsheet errors in totals, and no single view of what is awaiting approval or owed. — The description says expenses are tracked in spreadsheets and receipts collected by email but does not name the pains. [assumed] (assumption)
- A3 The data and tools used today are spreadsheets for tracking and email for receipts; no other system is named. — The description names spreadsheets and email only. [assumed] (assumption)
- A4 The administrator role is held by one or two IT or operations staff; they sign in to manage users, manager assignments and categories. — The description names the Administrator role but gives no head count. [assumed] (assumption)
- A5 Employees who never sign in are affected only through reimbursement; no such group is named. — The description names only signing-in roles. [assumed] (assumption)
- A6 The people who could lose out are employees whose reports are delayed by a manager reassignment or a rejected receipt. — The description does not name who could lose out. [assumed] (assumption)
- A7 The first release includes all three workflows (submit, review, record reimbursement) and the reports and administration screens described. — The description lists all of these as required for the first release.; high impact [assumed] (assumption)
- A8 There is no fixed launch date or budget stated; the constraint is the required stack and single application server. — The description gives no date or budget. [assumed] (assumption)
- A9 Business events the app must respond to: a report is submitted, a manager decides, an employee resubmits after changes, finance records a payment, an administrator reassigns a pending review, and a category is deactivated. — The description implies these events but does not list them as events.; high impact [assumed] (assumption)
- A10 Timed event: a submitted report that has waited more than 3 days for a manager decision is flagged in the manager inbox. — The description does not name a timed event; a waiting flag is a sensible default. [assumed] (assumption)
- A11 Exception: a receipt upload fails; the employee's entered values are preserved and the error is shown beside the line. — The description says to preserve values on failure but does not list it as an exception.; high impact [assumed] (assumption)
- A12 Exception: two managers act on the same report at once; the first valid decision is saved and the second user is told what changed. — The description states this rule but does not list it as an exception.; high impact [assumed] (assumption)
- A13 Exception: two finance users record payment for the same report at once; exactly one reimbursement and one audit event are created. — The description states this rule but does not list it as an exception.; high impact [assumed] (assumption)
- A14 Exception: an administrator reassigns a pending review; a reason is required and both managers are recorded in the history. — The description states this rule but does not list it as an exception.; high impact [assumed] (assumption)
- A15 Permissions: employees create, edit and submit their own reports and upload receipts; managers approve, request changes or reject reports assigned to them; finance records reimbursements and exports reports; administrators manage users, assignments and categories and inspect audit history; no role may approve or pay its own report. — The description gives these permissions but not as a grid.; high impact [assumed] (assumption)
- A16 A person may hold multiple roles; the same person may not both approve and record payment for the same report. — The description says a person may hold multiple roles and nobody may approve or pay their own report.; high impact [assumed] (assumption)
- A17 Volume: about 2,000 expense reports per month, roughly 24,000 per year, with 150 employees, 12 managers and 3 finance staff. — The description gives the monthly figure but not yearly.; high impact [assumed] (assumption)
- A18 Reports: the employee dashboard supports tracking their own reports; the manager inbox supports approval decisions; the finance dashboard supports outstanding and paid totals and payment history; the CSV export supports finance reconciliation. — The description lists the screens but not the decision each report supports.; high impact [assumed] (assumption)
- A19 Finance totals must be fresh to the last recorded payment; the manager inbox to the last submission. — The description does not state freshness. [assumed] (assumption)
- A20 Administrators can change users, manager assignments and categories without a developer; no per-site or per-customer settings exist. — The description lists administration screens but not the settings scope. [assumed] (assumption)
- A21 Key actions should respond within 2 seconds on the company network. — The description gives no response-time target. [assumed] (assumption)
- A22 An hour of outage during business hours blocks expense submission and approval; the target is 99% availability in business hours, with a recovery time of 4 hours and a recovery point of 1 hour. — The description gives no availability target.; high impact [assumed] (assumption)
- A23 Sign-in is by company email and password with session cookies; the worst misuse is one employee viewing another's report or receipt; finance and administrator data must never be visible to employees. — The description gives the authentication method but not the worst misuse.; high impact [assumed] (assumption)
- A24 Audit events must prove who submitted, decided, reassigned and paid, and when, and are kept for 7 years. — The description requires audit events but not a retention period.; high impact [assumed] (assumption)
- A25 Accessibility target is WCAG 2.2 AA; the language is English; currency is INR; time zone is Asia/Kolkata; no right-to-left language. — The description gives accessibility features but not the level. [assumed] (assumption)
- A26 Devices: employees use phones for entry and receipt photos; managers and finance use desktop; no offline mode is required. — The description says phone for employees and desktop for approval and finance but not offline. [assumed] (assumption)
- A27 Operations: the administrator is alerted when the health endpoint fails; support can see audit history and act on a user's behalf only through the administrator role. — The description gives a health endpoint but not who is alerted. [assumed] (assumption)
- A28 Risks: SQLite contention under 25 concurrent users, receipt files lost outside the database, and managers approving their own reports if permissions are not enforced in the API. — The description does not list risks.; high impact [assumed] (assumption)
- A29 Release 1 includes all three workflows and the screens described; nothing is deferred. — The description lists everything as required for the first release.; high impact [assumed] (assumption)
- A30 Success measure: by 6 months after launch, every report awaiting approval is visible to the owner within a day, and the amount owed to employees is known at any time. — The owner gave this measure without a date; a 6-month date is assumed. [assumed] (assumption)
## Other facts
- F1 Today the company tracks expenses in spreadsheets and collects receipts by email. [current] (description)
- F2 The company has 150 employees, 12 managers and 3 finance staff, with around 2,000 expense reports per month and up to 25 users working at the same time. [scale] (description)
- F3 The application records reimbursements made outside the system. [scope] (description)
- F4 Money is stored as integer paise and formatted as INR in the UI; timestamps are stored in UTC and displayed in Asia/Kolkata. [rules] (description)
- F5 Receipts are PDF, JPEG or PNG up to 5 MB per file, validated on the server and stored outside the public web directory. [files] (description)
- F6 Initial categories are Travel, Meals, Accommodation, Office Supplies and Other. [admin] (description)
- F7 The employee flow must be usable on a phone, including photographing and uploading a receipt; approval and finance tables are used on desktop. [devices] (description)
- F8 The app must include keyboard navigation, accessible form labels, visible focus, and clear loading, empty, success and error states. [access_i18n] (description)
- F9 Authentication is secure session-based with CSRF protection, password hashing, login rate limiting and expiring single-use password reset links. [security] (description)
- F10 An audit event is written for each submission, decision, reassignment and reimbursement, in the same transaction as the business action. [audit] (description)
- F11 The app must provide migrations, indexes for the main searches, and documented backup and restore steps covering both the database and receipt files. [operations] (description)
- F12 In local development, Vue and PHP use separate configurable ports, with one documented command that starts both and proxies /api to the backend; in production the compiled frontend and API are served under the same HTTPS origin. [hosting] (description)
- F13 The app must include a health endpoint that verifies the API can read the database. [operations] (description)
- F14 Delivery includes database migrations, development-only sample data, automated PHP API tests, Vue component tests, browser tests for the employee, manager and finance workflows, and a README with setup, start, test, deployment, backup and restore instructions. [scope] (description)
## Out of scope and later releases
- S1 Moving money, storing bank account details, payroll, tax filing, foreign currencies and multi-company support are outside the first release. [out of scope] (description)
- S2 Partial reimbursements are outside scope. [out of scope] (description)
## The interview
- Q3 [success · owner] Six months after ExpenseDesk goes live, what would you look at to say it is working — something you could count, like the number of reports awaiting approval or the amount owed to employees? → Every report awaiting approval is visible to the owner within a day, and the amount owed to employees is known at any time. (Greenfield's draft, sent unchanged)
- Q4 [similar · owner] Which expense or reimbursement tools have you seen or tried, and what did you like or dislike about them? → Decide for me (settled: No specific expense tool is named; Greenfield builds the workflow from the description, copying the clear approval and audit trail of common expense tools and avoiding their complexity.)
