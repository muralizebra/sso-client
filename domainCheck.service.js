/**
 * Domain Check Service
 *
 * Validates the user's email or domain, looks up the SSO integration,
 * and returns the config the frontend needs to build the /authorize URL.
 *
 * Auth method behaviour:
 *
 *   client_auth_method = 'none' (PKCE):
 *     - Backend generates: state, nonce, code_verifier, code_challenge
 *     - Stores in session: { state, nonce, code_verifier, company_id, createdAt }
 *     - Returns to frontend: state, nonce, code_challenge, code_challenge_method
 *     - code_verifier NEVER leaves the server
 *
 *   client_auth_method = 'client_secret' | 'client_secret_post' | 'private_key_jwt':
 *     - Backend generates: state, nonce
 *     - Stores in session: { state, nonce, company_id, createdAt }
 *     - Returns to frontend: state, nonce, client_id, sso_url, redirect_uri, scope
 *     - No code_verifier needed — credential resolved server-side at token exchange
 */

const crypto   = require('crypto');
const mockData = require('../../mock/ssoData.json');
const { buildSamlRedirectUrl } = require('../Saml/samlAuthRequest.service');

const EMAIL_REGEX  = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const DOMAIN_REGEX = /^[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ── Config Readers ────────────────────────────────────────────────────────────

// Reads SAML config for a company
// TODO: Replace mockData with DB query in production
const getSamlConfig = (company_id) => {
  const saml = mockData.saml_configurations.find(r => r.company_id === company_id);
  if (!saml) return null;

  return {
    company_id,
    protocol:  'saml',
    entity_id: saml.entity_id,
    sso_url:   saml.sso_url,
    acs_url:   saml.acs_url
  };
};

// Reads OIDC config for a company
// TODO: Replace mockData with DB query in production
const getOidcConfig = (company_id, entra_tenant_id) => {
  const oidc = mockData.oidc_configurations.find(r => r.company_id === company_id);
  if (!oidc) return null;

  return {
    company_id,
    protocol:           'oidc',
    entra_tenant_id,
    client_id:          oidc.client_id,
    client_auth_method: oidc.client_auth_method,
    sso_url:            oidc.sso_url,
    redirect_uri:       oidc.redirect_uri
  };
};

// Finds the active SSO integration for a domain
// TODO: Replace mockData with DB query in production
const lookupSsoConfig = (domain) => {
  const integration = mockData.sso_integrations.find(
    r => r.domains === domain && r.sso_status === 'active'
  );
  if (!integration) return null;

  const readers = {
    saml: () => getSamlConfig(integration.company_id),
    oidc: () => getOidcConfig(integration.company_id, integration.entra_tenant_id)
  };

  return readers[integration.protocol]?.() ?? null;
};

// ── OIDC Response Builder ─────────────────────────────────────────────────────

/**
 * Builds the OIDC domain check response based on client_auth_method.
 *
 * PKCE (none):
 *   Generates state, nonce, code_verifier server-side.
 *   Stores them in req.session.oidc (10-min TTL set on cookie in server.js).
 *   Returns code_challenge to frontend — code_verifier stays on server only.
 *
 * client_secret_post / private_key_jwt:
 *   No server-side session needed at this stage.
 *   Frontend generates its own state and nonce and stores in sessionStorage.
 *   Backend only returns the config needed to build the /authorize URL.
 *   State and nonce validation at callback is handled by the frontend for these methods.
 */
const buildOidcResponse = (config, session) => {
  // Backend always owns state and nonce — never generated client-side
  const state = crypto.randomBytes(16).toString('base64url');
  const nonce = crypto.randomBytes(16).toString('base64url');

  const sessionEntry = {
    state,
    nonce,
    company_id: config.company_id,
    createdAt:  Date.now()
  };

  const oidcConfig = {
    client_id:    config.client_id,
    sso_url:      config.sso_url,
    redirect_uri: config.redirect_uri,
    scope:        'openid profile email',
    state,
    nonce,
    response_mode: 'query'
  };

  if (config.client_auth_method === 'none') {
    // PKCE — code_verifier stays on server, challenge goes to frontend
    const code_verifier  = crypto.randomBytes(32).toString('base64url');
    const code_challenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

    sessionEntry.code_verifier         = code_verifier;
    oidcConfig.code_challenge          = code_challenge;
    oidcConfig.code_challenge_method   = 'S256';
  }

  session.oidc = sessionEntry;

  return {
    found:              true,
    protocol:           'oidc',
    message:            'Redirecting to Microsoft Entra...',
    company_id:         config.company_id,
    client_auth_method: config.client_auth_method,
    config:             oidcConfig
  };
};

// ── SAML Response Builder ─────────────────────────────────────────────────────

const buildSamlResponse = async (config, session, sessionID) => {
  const redirectUrl = await buildSamlRedirectUrl(
    config.entity_id,
    config.acs_url,
    config.sso_url,
    session,
    sessionID
  );

  return {
    found:       true,
    protocol:    'saml',
    message:     'Redirecting to Microsoft Entra...',
    redirectUrl
  };
};

// ── Main Export ───────────────────────────────────────────────────────────────

const checkDomain = async (email, domain, session, sessionID) => {
  if (!email && !domain) {
    const err = new Error('Email or domain is required');
    err.statusCode = 400;
    err.code = 'MISSING_INPUT';
    throw err;
  }

  if (!session || !sessionID) {
    const err = new Error('Session unavailable');
    err.statusCode = 500;
    err.code = 'MISSING_SESSION';
    throw err;
  }

  let extractedDomain;

  if (email) {
    if (!EMAIL_REGEX.test(email)) {
      const err = new Error('Invalid email format');
      err.statusCode = 400;
      err.code = 'INVALID_EMAIL';
      throw err;
    }
    extractedDomain = email.split('@')[1].toLowerCase();
  } else {
    if (!DOMAIN_REGEX.test(domain)) {
      const err = new Error('Invalid domain format');
      err.statusCode = 400;
      err.code = 'INVALID_DOMAIN';
      throw err;
    }
    extractedDomain = domain.toLowerCase();
  }

  const config = lookupSsoConfig(extractedDomain);

  if (!config) {
    return email
      ? { found: false, promptOrgDomain: true,  message: 'Please enter your organisation domain name' }
      : { found: false, promptOrgDomain: false, message: 'SSO is not available for this domain. Please contact your administrator.' };
  }

  if (config.protocol === 'saml') return buildSamlResponse(config, session, sessionID);

  return buildOidcResponse(config, session);
};

module.exports = { checkDomain };
