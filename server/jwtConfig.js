const path = require('path');

// Allow isolating tests from local .env file when testing missing secrets
if (process.env.IGNORE_ENV_FILE !== 'true') {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  require('dotenv').config();
}

const MIN_SECRET_LENGTH = 32;

// Known insecure / default placeholder strings that must NEVER be accepted
const REJECTED_SECRETS = new Set([
  'studystream_dev_secret_key_2026_super_secure',
  'your_super_secret_jwt_key_here',
  'your_jwt_secret',
  'your_secret_key_here',
  'replace_with_a_secure_random_64_char_hex_secret_min_32_chars',
  'generate_with_openssl_rand_hex_32',
  'secret',
  'jwt_secret',
  'password',
  'changeme',
  '1234567890',
  '12345678901234567890123456789012'
]);

/**
 * Validates a candidate JWT secret.
 * Throws a descriptive error if the secret is missing, empty, too short, or insecure.
 * 
 * @param {string|undefined|null} secret
 * @returns {string} The validated secret
 */
function validateJwtSecret(secret) {
  if (secret === undefined || secret === null) {
    throw new Error(
      'JWT_SECRET environment variable is missing. A cryptographically secure secret (at least 32 characters) is required to start the server.'
    );
  }

  if (typeof secret !== 'string') {
    throw new Error(
      `JWT_SECRET environment variable must be a string (received ${typeof secret}).`
    );
  }

  const trimmed = secret.trim();

  if (trimmed.length === 0) {
    throw new Error(
      'JWT_SECRET environment variable is empty or whitespace only. A valid secret is required.'
    );
  }

  // Reject known placeholders, defaults, and common weak strings first
  if (REJECTED_SECRETS.has(trimmed.toLowerCase())) {
    throw new Error(
      'JWT_SECRET is set to an insecure, known default or placeholder string. You must generate a unique, random cryptographic secret.'
    );
  }

  if (trimmed.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long for cryptographic security (found ${trimmed.length} characters). Generate one with: openssl rand -hex 32`
    );
  }

  // Check for trivial low-entropy patterns (e.g. all same character like "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
  const uniqueChars = new Set(trimmed);
  if (uniqueChars.size <= 2) {
    throw new Error(
      'JWT_SECRET has insufficient entropy (contains too few unique characters). Generate a secure secret with: openssl rand -hex 32'
    );
  }

  return trimmed;
}

/**
 * Validates and retrieves the active server JWT_SECRET.
 * If validation fails in production or development, terminates server startup with process.exit(1).
 */
function getOrAssertJwtSecret(secretToValidate = process.env.JWT_SECRET) {
  try {
    return validateJwtSecret(secretToValidate);
  } catch (err) {
    console.error('====================================================================');
    console.error('❌ FATAL: JWT_SECRET CONFIGURATION ERROR');
    console.error('--------------------------------------------------------------------');
    console.error(err.message);
    console.error('👉 To generate a secure 64-character hex secret, run:');
    console.error('     openssl rand -hex 32');
    console.error('   or:');
    console.error('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('Then set JWT_SECRET in your server environment or server/.env file.');
    console.error('====================================================================');

    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw err;
  }
}

module.exports = {
  validateJwtSecret,
  getOrAssertJwtSecret,
  MIN_SECRET_LENGTH,
  REJECTED_SECRETS
};
