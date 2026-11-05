# CampusCare complaint portal

A responsive campus complaint portal with separate student and management access. The frontend uses HTML, CSS, and browser JavaScript. An Express server provides the API and connects to MySQL; browser code never receives database credentials.

## Set up

1. Install Node.js and MySQL.
2. Create the tables by running `schema.sql` in MySQL, for example: `mysql -u root -p < schema.sql`.
3. Copy `.env.example` to `.env` and set your MySQL connection and a long random `SESSION_SECRET`.
4. Install packages with `npm install`.
5. Start the portal with `npm start`, then visit `http://localhost:3000`.

## Accounts

- **Student:** Choose Student at sign in, then create an account with a name, registration number, and password (8–72 characters). Students can submit complaints and track status and replies.
- **Management:** Management accounts must be added by an administrator. Generate a password hash using `node -e "require('bcryptjs').hash('choose-a-strong-password',12).then(console.log)"`, then insert the account into MySQL:

  ```sql
  INSERT INTO management_users (name, email, password_hash)
  VALUES ('Campus Administrator', 'admin@campus.edu', 'PASTE_BCRYPT_HASH_HERE');
  ```

  Sign in with the management email and password. Management can search all complaints, change their status, and reply to students.

## Notes

Sessions are stored in MySQL. Use HTTPS and a unique secret in production. Restrict student registration to approved registration numbers if accounts should only be available to enrolled students (for example, add an administrator-managed student directory and validate against it during registration). The sample project allows self-registration and does not include password reset or email verification.
