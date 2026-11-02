# Requirements: ExpenseDesk

ExpenseDesk is the internal web app of one Indian company where 150 Employees submit expense reports with receipts, 12 Managers approve or request changes, 3 Finance staff record reimbursements, and Administrators manage users, manager assignments and categories. It replaces spreadsheet tracking and email receipts with one audited workflow that shows the owner what is awaiting approval, what the company owes Employees and what has already been paid.

The app opens at `/`, which shows the sign-in page. After signing in, a person opens the first screen of their role: an Employee opens the Employee dashboard, a Manager opens the Manager approval inbox, Finance opens the Finance dashboard, and an Administrator opens the Administration users screen. A person who holds several roles opens the first screen of the highest role they hold, in the order Administrator, Finance, Manager, Employee, and reaches the other roles' screens from the main navigation.

## Requirement 1: Sign in and password recovery

**User Story:** As an Employee, a Manager, Finance staff or an Administrator, I want to sign in with my company email and password and recover my password, so that only I reach my own reports and screens.

_Source: R1, R2, R3, R4, F9, A23_

### Acceptance Criteria

1. WHEN a person opens `/` without a session THE SYSTEM SHALL show the sign-in page with an email field, a password field and a Sign in button.
2. WHEN a person enters the email and password of an active account and clicks Sign in THE SYSTEM SHALL create a session and open the first screen of that person's highest role.
3. IF the email or password is wrong THEN THE SYSTEM SHALL show the message "Email or password is incorrect" and keep the email field filled.
4. IF a person fails to sign in 5 times within 15 minutes for the same email THEN THE SYSTEM SHALL refuse further sign-in attempts for that email for 15 minutes and show the message "Too many attempts. Try again in 15 minutes."
5. WHEN a signed-in person clicks Sign out THE SYSTEM SHALL end the session and show the sign-in page.
6. WHEN a person clicks Forgot password, enters their email and submits THE SYSTEM SHALL show the message "If that email has an account, a reset link has been sent" whether or not the email has an account.
7. WHEN a person opens a password reset link that was issued less than 60 minutes ago and has not been used, and enters a new password of at least 12 characters twice THE SYSTEM SHALL set the new password, mark the link used and show the sign-in page.
8. IF a password reset link is older than 60 minutes or already used THEN THE SYSTEM SHALL show the message "This reset link is no longer valid" and offer to send a new one.
9. IF a deactivated account tries to sign in THEN THE SYSTEM SHALL show the message "Email or password is incorrect" and create no session.
10. WHEN an Administrator deactivates an account THE SYSTEM SHALL end every session that account holds, so its next request shows the sign-in page.

## Requirement 2: Employee dashboard

**User Story:** As an Employee, I want to see my reports grouped by where they stand, so that I know what is a draft, what awaits approval, what needs my changes and what has been paid.

_Source: W1, E1, A18, F7_

### Acceptance Criteria

1. WHEN an Employee opens the Employee dashboard THE SYSTEM SHALL show five groups in this order — Draft, Awaiting approval, Changes requested, Approved and Paid — each with the number of reports in it and the total amount of those reports in INR.
2. WHEN an Employee opens the Employee dashboard THE SYSTEM SHALL list each of their reports with its title, its total in INR, its status and the date it was last updated, newest first.
3. WHEN an Employee clicks a report in the list THE SYSTEM SHALL open the report details of that report.
4. WHEN an Employee clicks New report THE SYSTEM SHALL open the report editor with an empty draft.
5. IF an Employee has no reports THEN THE SYSTEM SHALL show the message "You have no expense reports yet" with a New report button.
6. WHILE the Employee dashboard is loading its reports THE SYSTEM SHALL show a loading state in place of the list.
7. IF loading the reports fails THEN THE SYSTEM SHALL show the message "Reports could not be loaded" with a Try again button.
8. WHEN an Employee clicks a report in the Changes requested group THE SYSTEM SHALL open the report editor for that report.

## Requirement 3: Report editor

**User Story:** As an Employee, I want to create a report with a title, a business purpose and expense lines with receipts, so that I can claim what I spent and submit it for approval.

_Source: W1, E1, E2, E3, BR1, BR4, F5, F7, A11_

### Acceptance Criteria

1. WHEN an Employee opens the report editor THE SYSTEM SHALL show a title field, a business purpose field, a list of expense lines and a running total in INR that adds up the amounts of the lines.
2. WHEN an Employee clicks Add line THE SYSTEM SHALL add an expense line with an expense date field, a category select listing Travel, Meals, Accommodation, Office Supplies and Other, a merchant field, an amount field in INR and an optional note field.
3. WHEN an Employee enters an amount of 750.50 on one line and 1250.25 on another THE SYSTEM SHALL show the running total as ₹2,000.75.
4. WHEN an Employee adds a receipt to a line whose amount is ₹1,000 or more THE SYSTEM SHALL accept a PDF, JPEG or PNG file of up to 5 MB and show the file name beside that line.
5. IF an Employee adds a file that is larger than 5 MB or is not a PDF, JPEG or PNG THEN THE SYSTEM SHALL show the message "Receipts must be a PDF, JPEG or PNG of up to 5 MB" beside that line and keep the line's entered values.
6. WHEN an Employee clicks Save draft THE SYSTEM SHALL save the report as Draft with the title, business purpose and lines entered so far, even when fields are empty.
7. WHEN an Employee clicks Submit THE SYSTEM SHALL show the message "Receipt required" beside each line of ₹1,000 or more that has no receipt, and the message "Required" beside each empty title, business purpose, expense date, category, merchant or amount.
8. IF a report has no expense lines THEN THE SYSTEM SHALL show the message "Add at least one expense line" and not submit the report.
9. IF an amount is zero or negative, or an expense date is after today in Asia/Kolkata THEN THE SYSTEM SHALL show the message "Amount must be more than zero" or "Expense date cannot be in the future" beside that line and not submit the report.
10. WHEN an Employee submits a report that passes every check THE SYSTEM SHALL set its status to Submitted, assign the Employee's manager, record the submission in the activity history and open the report details.

## Requirement 4: Report details and activity history

**User Story:** As an Employee, a Manager or Finance staff, I want to see a report with its receipts, reviewer comments and history, so that I know what was claimed, decided and paid.

_Source: W1, W2, E1, E6, F10, A24_

### Acceptance Criteria

1. WHEN a person opens the report details of a report they may see THE SYSTEM SHALL show its title, business purpose, Employee, Manager, status, total in INR, each expense line with its expense date, category, merchant, amount and note, and each receipt as a link that opens the file.
2. WHEN a person opens the report details THE SYSTEM SHALL show the activity history newest first, each entry with the action, the actor's name, the time in Asia/Kolkata and, for a decision, the reason.
3. WHEN a Manager requests changes or rejects a report THE SYSTEM SHALL add an entry to the activity history with the Manager's name, the time and the reason.
4. WHEN an Employee edits a report that is Changes requested and submits it again THE SYSTEM SHALL keep the earlier submission and the Manager's reason in the activity history and add the new submission below them.
5. WHEN Finance records a reimbursement THE SYSTEM SHALL add an entry to the activity history with the amount in INR, the payment date, the payment reference and the name of the person who recorded it.
6. IF a person opens the report details or a receipt of a report they may not see THEN THE SYSTEM SHALL show the message "You do not have access to this report" and show none of its content.
7. WHEN an Administrator reassigns a pending review THE SYSTEM SHALL add an entry to the activity history with the reason, the previous Manager's name and the new Manager's name.
8. WHEN a person opens the report details THE SYSTEM SHALL show the receipts and the activity history of a report that was paid, with no button that changes it.

## Requirement 5: Manager approval inbox

**User Story:** As a Manager, I want to see the reports submitted by my Employees and decide on them, so that expenses are approved, corrected or rejected without delay.

_Source: W2, BR2, BR3, A10, A12, F7_

### Acceptance Criteria

1. WHEN a Manager opens the Manager approval inbox THE SYSTEM SHALL list the Submitted reports of the Employees assigned to them with the Employee's name, the report title, the submission date, the total in INR and the number of days it has waited.
2. WHEN a Manager filters the inbox by Employee, by a submission date range or by an amount range THE SYSTEM SHALL list only the reports that match every filter set.
3. WHEN a Manager clicks a report in the inbox THE SYSTEM SHALL open the report details with the buttons Approve, Request changes and Reject.
4. WHEN a Manager clicks Approve THE SYSTEM SHALL set the report to Approved, record the decision in the activity history and remove it from the inbox.
5. WHEN a Manager clicks Request changes or Reject THE SYSTEM SHALL require a reason of at least 10 characters, then set the report to Changes requested or Rejected, record the reason in the activity history and remove it from the inbox.
6. IF a report has waited more than 3 days since submission THEN THE SYSTEM SHALL show the label "Waiting 3+ days" beside it in the inbox.
7. IF a Manager tries to approve, request changes on or reject their own report THEN THE SYSTEM SHALL show the message "You cannot decide on your own report" and keep the report Submitted.
8. IF two Managers decide on the same report at the same time THEN THE SYSTEM SHALL save the first decision and show the second Manager the message "This report was already decided by <name> as <status>".
9. IF a Manager opens a report that is no longer Submitted THEN THE SYSTEM SHALL show its current status and hide the Approve, Request changes and Reject buttons.
10. IF the inbox has no reports matching the filters THEN THE SYSTEM SHALL show the message "No reports match these filters".

## Requirement 6: Finance dashboard and reimbursement

**User Story:** As Finance staff, I want to see what is approved and unpaid, record reimbursements and review what was paid, so that the company pays Employees once and knows what it owes.

_Source: W3, E4, BR5, A13, A18, F7_

### Acceptance Criteria

1. WHEN Finance opens the Finance dashboard THE SYSTEM SHALL show the approved unpaid total in INR, the number of approved unpaid reports, and the reimbursements paid during the selected period with their total in INR.
2. WHEN Finance opens the Finance dashboard THE SYSTEM SHALL list the approved unpaid reports with the Employee's name, the report title, the approval date and the total in INR.
3. WHEN Finance selects a period THE SYSTEM SHALL total the reimbursements whose payment date falls in that period, and show the current month as the selected period when the dashboard opens.
4. WHEN Finance clicks Record payment on an approved unpaid report THE SYSTEM SHALL ask for a payment date, a payment reference of at least 3 characters and the full approved amount in INR, and show the amount filled in and not editable.
5. WHEN Finance confirms a payment THE SYSTEM SHALL set the report to Paid, create one reimbursement with the full approved amount, the payment date and the payment reference, record it in the activity history, and remove the report from the approved unpaid total.
6. WHEN a report of ₹2,000.75 is approved and unpaid THE SYSTEM SHALL count ₹2,000.75 in the approved unpaid total, and after it is paid THE SYSTEM SHALL remove it from that total and count ₹2,000.75 in the paid total of its payment date.
7. IF two Finance users record payment for the same report at the same time THEN THE SYSTEM SHALL create exactly one reimbursement and one reimbursement entry in the activity history, and show the second user the message "This report was already paid".
8. IF Finance clicks Record payment twice on the same report THEN THE SYSTEM SHALL create exactly one reimbursement.
9. IF a payment date is after today in Asia/Kolkata THEN THE SYSTEM SHALL show the message "Payment date cannot be in the future" and not record the payment.
10. WHEN Finance searches the payment history by Employee name, report title or payment reference THE SYSTEM SHALL list only the reimbursements that match, with the payment date, the payment reference, the Employee's name, the report title and the amount in INR.

## Requirement 7: CSV export

**User Story:** As Finance staff, I want to export the payments I am looking at to CSV, so that I can reconcile them in a spreadsheet.

_Source: W3, A18, F14_

### Acceptance Criteria

1. WHEN Finance clicks Export CSV on the Finance dashboard THE SYSTEM SHALL download a CSV file of the reimbursements that match the active period and search filters, with the columns Payment date, Payment reference, Employee, Report title and Amount in INR.
2. WHEN the CSV file is opened THE SYSTEM SHALL show each amount as a decimal number of rupees with two decimals and no currency symbol, such as 2000.75.
3. WHEN a CSV cell holds text that starts with `=`, `+`, `-` or `@` THE SYSTEM SHALL write that text with a leading apostrophe, so a spreadsheet shows it as text and runs no formula.
4. IF no reimbursement matches the active filters THEN THE SYSTEM SHALL download a CSV file with the header row only.

## Requirement 8: Administration

**User Story:** As an Administrator, I want to manage users, manager assignments and categories and inspect the audit history, so that the app stays correct without a developer.

_Source: R4, E5, E6, F6, A4, A20, A14_

### Acceptance Criteria

1. WHEN an Administrator opens the Administration users screen THE SYSTEM SHALL list every user with their name, email, roles, assigned Manager and active state.
2. WHEN an Administrator creates a user with a name, an email, at least one role and an initial password of at least 12 characters THE SYSTEM SHALL create an active account that can sign in.
3. WHEN an Administrator deactivates a user THE SYSTEM SHALL keep the user's reports and history and end that user's sessions.
4. WHEN an Administrator assigns a Manager to an Employee THE SYSTEM SHALL use that Manager for the Employee's next submission.
5. WHEN an Administrator reassigns the Manager of a Submitted report THE SYSTEM SHALL require a reason of at least 10 characters and record the previous Manager, the new Manager and the reason in the activity history.
6. WHEN an Administrator opens the Administration categories screen THE SYSTEM SHALL list the categories Travel, Meals, Accommodation, Office Supplies and Other with their active state.
7. WHEN an Administrator adds a category with a name THE SYSTEM SHALL offer it in the report editor's category select.
8. WHEN an Administrator deactivates a category THE SYSTEM SHALL remove it from the report editor's category select and keep it on every report that already uses it.
9. WHEN an Administrator opens the audit history THE SYSTEM SHALL list every audit event with the actor, the time in Asia/Kolkata, the report and the state change, newest first, and offer no control that edits or deletes an event.
10. IF a person without the Administrator role opens an Administration screen or calls its API THE SYSTEM SHALL show the message "You do not have access to this page" and change nothing.

## Requirement 9: Access control in the API

**User Story:** As the owner, I want every permission enforced by the PHP API, so that nobody sees or changes a report, receipt or payment they are not allowed to.

_Source: R1, R2, R3, R4, BR2, A15, A16, A23_

### Acceptance Criteria

1. IF a request carries no valid session THEN THE SYSTEM SHALL answer 401 and change nothing.
2. IF an Employee requests a report, a receipt or a reimbursement of another Employee THEN THE SYSTEM SHALL answer 403 and return none of its content.
3. IF a Manager decides on a report that is not assigned to them THEN THE SYSTEM SHALL answer 403 and keep the report unchanged.
4. IF a person approves or records payment for a report they submitted THEN THE SYSTEM SHALL answer 403 and keep the report unchanged.
5. IF an Employee calls an Administration, approval or reimbursement endpoint THEN THE SYSTEM SHALL answer 403 and change nothing.
6. WHEN a request changes data without the session's CSRF token THE SYSTEM SHALL answer 419 and change nothing.
7. IF a deactivated account makes a request with a session it held before deactivation THEN THE SYSTEM SHALL answer 401 and change nothing.
8. WHEN a person signs in THE SYSTEM SHALL store the session in an HttpOnly cookie and hash every password with a one-way hash.

## Requirement 10: Audit trail

**User Story:** As the owner, I want an audit event for every submission, decision, reassignment and reimbursement, so that the history proves who did what and when.

_Source: E6, F10, A24_

### Acceptance Criteria

1. WHEN an Employee submits a report THE SYSTEM SHALL write one audit event with the actor, the time in UTC, the report and the change from Draft or Changes requested to Submitted, in the same database transaction as the submission.
2. WHEN a Manager approves, requests changes on or rejects a report THE SYSTEM SHALL write one audit event with the actor, the time, the report, the previous status, the new status and the reason, in the same transaction as the decision.
3. WHEN an Administrator reassigns a pending review THE SYSTEM SHALL write one audit event with the actor, the time, the report, the previous Manager and the new Manager, in the same transaction as the reassignment.
4. WHEN Finance records a reimbursement THE SYSTEM SHALL write one audit event with the actor, the time, the report and the change from Approved to Paid, in the same transaction as the reimbursement.
5. IF the business action fails THEN THE SYSTEM SHALL write no audit event for it.
6. IF a request tries to change or delete an audit event through the API THEN THE SYSTEM SHALL answer 405 and keep the event unchanged.
7. WHEN a person opens the audit history of a report THE SYSTEM SHALL show every event of that report in the order it was written.

## Requirement 11: Money, dates and totals

**User Story:** As the owner, I want totals and dates to be exact, so that what the company owes and paid is right to the paisa.

_Source: F4, BR4, E1_

### Acceptance Criteria

1. WHEN the API stores an amount THE SYSTEM SHALL store it as an integer number of paise, so ₹2,000.75 is stored as 200075.
2. WHEN the app shows an amount THE SYSTEM SHALL format it as INR with the ₹ symbol, a comma for thousands and two decimals, such as ₹2,000.75.
3. WHEN the API stores a time THE SYSTEM SHALL store it in UTC and the app SHALL show it in Asia/Kolkata.
4. WHEN the API stores an expense date or a payment date THE SYSTEM SHALL store it as a calendar date with no time and no time zone, so it shows the same day in every time zone.
5. WHEN the API computes a report total THE SYSTEM SHALL add the amounts of its lines in paise on the server and return that total, never a total sent by the browser.
6. IF a request sends an amount of zero or less, or an expense date after today in Asia/Kolkata THEN THE SYSTEM SHALL answer 422 with the field and the message and change nothing.

## Requirement 12: Production operation

**User Story:** As the owner and the Administrator, I want the app to run safely on one server, keep its data across restarts and be restorable from a backup, so that the company can rely on it.

_Source: S3, F11, F12, F13, F5, A22, A27, A28_

### Acceptance Criteria

1. WHEN a person opens `/api/health` THE SYSTEM SHALL answer 200 with the status "ok" when the API can read the database, and 503 with the status "error" when it cannot.
2. WHEN the app starts with the documented development command THE SYSTEM SHALL run the Vue frontend and the Laravel API on the two ports set in the environment, and the frontend SHALL send every `/api` request to the API.
3. WHEN the app is deployed THE SYSTEM SHALL serve the compiled frontend and the API under one HTTPS origin.
4. WHEN the app restarts THE SYSTEM SHALL keep every report, receipt and audit event, because the database is a file on the server and receipts are stored outside the public web directory.
5. WHEN the database is opened THE SYSTEM SHALL enforce foreign keys.
6. WHEN a decision or a reimbursement is saved THE SYSTEM SHALL use a database transaction and a unique constraint, so a report has at most one reimbursement.
7. IF the database is busy for less than 5 seconds THEN THE SYSTEM SHALL retry the request and complete it, and IF it stays busy THEN THE SYSTEM SHALL answer 503 with the message "The system is busy. Try again."
8. WHEN the documented backup command runs THE SYSTEM SHALL copy the database file and the receipt folder to one backup folder, and the documented restore steps SHALL restore both into a separate location and show the restored reports, receipts and audit events there.
9. WHEN the app writes a log line THE SYSTEM SHALL never write a password, a password reset token or the contents of a receipt.
10. WHEN the app is running THE SYSTEM SHALL keep secrets in environment variables outside source control, and the README SHALL give the setup, start, test, deployment, backup and restore commands.

## Requirement 13: Usability and accessibility

**User Story:** As an Employee on a phone and as a Manager or Finance user on a desktop, I want screens that are quick to use and work with a keyboard, so that I can claim and approve expenses wherever I am.

_Source: F7, F8, A21, A25, A26_

### Acceptance Criteria

1. WHEN an Employee opens the Employee dashboard, the report editor or the report details on a phone 390 pixels wide THE SYSTEM SHALL show each screen with no horizontal scrolling and with buttons at least 44 pixels high.
2. WHEN an Employee clicks Add receipt on a phone THE SYSTEM SHALL offer the camera as well as the file picker.
3. WHEN a Manager or Finance user opens the Manager approval inbox or the Finance dashboard on a desktop 1280 pixels wide THE SYSTEM SHALL show the reports in a table with a header row and sortable columns.
4. WHEN a person uses only the Tab key THE SYSTEM SHALL move focus through every field, button and link in reading order and show a visible focus outline on each.
5. WHEN a person uses a screen reader THE SYSTEM SHALL give every field a label and every button a name that says what it does.
6. WHEN a person submits a form THE SYSTEM SHALL show a success message, and WHEN a request fails THE SYSTEM SHALL show an error message that says what failed and what to do next.
7. WHEN a person opens a screen that loads data THE SYSTEM SHALL show a loading state until the data arrives.
8. WHEN a screen has no data to show THE SYSTEM SHALL show an empty state with a message and, where it applies, the action that adds data.
9. WHEN a person uses the app on the company network THE SYSTEM SHALL answer each screen's data request within 2 seconds for 95% of requests.

## Later releases

- S1 Moving money, storing bank account details, payroll, tax filing, foreign currencies and multi-company support.
- S2 Partial reimbursements.

## Assumptions

- The owner's visibility comes from the Finance dashboard's approved unpaid total and paid-period total, and from the Manager approval inbox, which an Administrator may open; no separate owner screen is built.
- A Manager sees only the Employees assigned to them, and an Administrator assigns one Manager to each Employee.
- An Administrator may reassign the Manager of a Submitted report; the Employee's own Manager assignment changes only from the Administration users screen.
- A person who holds several roles opens the first screen of the highest role they hold, in the order Administrator, Finance, Manager, Employee.
- The "Waiting 3+ days" label counts whole days from the submission time in Asia/Kolkata.
- A payment reference is free text of at least 3 characters; the app does not check it against a bank.
- The selected period on the Finance dashboard is a pair of dates, and the current month is selected when the dashboard opens.
- The audit history is readable by an Administrator for every report and by the report's Employee and Manager for their own report.
- The 2-second response target is measured on the company network for the data requests of a screen, not for receipt uploads.
- Sample data for development is created by a seed command that is never run in production.
