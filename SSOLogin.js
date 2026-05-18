
import { Button, Form, Input, message } from "antd"
import { useState } from "react"

const SCREEN = {
    SSO_BUTTON: 'SSO_BUTTON',
    SSO_EMAIL: 'SSO_EMAIL',
    SSO_DOMAIN: 'SSO_DOMAIN',
}

const buildOidcAuthorizeUrl = (config) => {
  const params = new URLSearchParams({
    client_id: config.client_id,
    response_type: 'code',
    redirect_uri: config.redirect_uri,
    scope: config.scope,
    state: config.state,
    nonce: config.nonce,
    response_mode: config.response_mode || 'query',
  });

  if (config.code_challenge) {
    params.set('code_challenge', config.code_challenge);
    params.set('code_challenge_method', config.code_challenge_method);
  }

  return `${config.sso_url}?${params.toString()}`;
};


const triggerSSORedirect = (payload) => {
  if (payload.protocol === 'saml') {
    window.location.href = payload.redirectUrl;
    return;
  }

  if (payload.protocol === 'oidc') {
    sessionStorage.setItem('oidc_company_id', payload.company_id);
    const authorizeUrl = buildOidcAuthorizeUrl(payload.config);
    window.location.href = authorizeUrl;
  }
};

const fetchSSOConfig = async (payload) => {
    let response;

    try {
        response = await fetch("http://localhost:5000/auth/domain-check", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            credentials:'include',
            body: JSON.stringify(payload)
        });
    } catch (networkErr) {
        // fetch itself threw — network down, server unreachable, DNS failure
        const err = new Error('Unable to reach the server. Please check your connection.');
        err.code = 'NETWORK_ERROR';
        throw err;
    }

    let data;
    try {
        data = await response.json();
    } catch (parseErr) {
        const err = new Error('Invalid response from server.');
        err.code = 'PARSE_ERROR';
        throw err;
    }

    if (!response.ok) {
        const err = new Error(data.error?.message || 'Request failed');
        err.statusCode = response.status;
        err.code = data.error?.code;
        throw err;
    }

    return data;
}

const getErrorMessage = (err) => {
    switch (err.statusCode) {
        case 400: return 'Invalid input. Please check your email or domain.';
        case 401: return 'Authentication failed. Please try again.';
        case 404: return 'SSO not configured for this email or domain.';
        case 429: return 'Too many attempts. Please wait and try again.';
        case 500: return 'Server error. Please try again later.';
        default:
            return err.message || 'Something went wrong. Please try again.';
    }
}

export const SSOLogin = ({ handleSSORedirect }) => {
    const [screen, setScreen] = useState(SCREEN.SSO_BUTTON);
    const [ssoEmail, setSSOEmail] = useState("");
    const [orgDomain, setOrgDomain] = useState("");
    const [loading, setLoading] = useState(false);

    const handleEmailContinue = async () => {
        if (!ssoEmail.trim()) {
            message.error('Please enter your email address.');
            return;
        }

        setLoading(true);
        try {
            const data = await fetchSSOConfig({ email: ssoEmail });
            if (data.found) {
                triggerSSORedirect(data);
            } else if (data.promptOrgDomain) {
                setScreen(SCREEN.SSO_DOMAIN);
            } else {
                message.error('SSO not configured for this email.');
            }
        } catch (err) {
            if (err.code === 'NETWORK_ERROR') {
                message.error(err.message);
            } else {
                message.error(getErrorMessage(err));
            }
        } finally {
            setLoading(false);
        }
    }

    const handleDomainContinue = async () => {
        if (!orgDomain.trim()) {
            message.error('Please enter your organization domain.');
            return;
        }

        setLoading(true);
        try {
            const data = await fetchSSOConfig({ domain: orgDomain });

            if (data.found) {
                triggerSSORedirect(data);
            } else {
                message.error('SSO not configured for this domain.');
            }
        } catch (err) {
            if (err.code === 'NETWORK_ERROR') {
                message.error(err.message);
            } else {
                message.error(getErrorMessage(err));
            }
        } finally {
            setLoading(false);
        }
    }

    if (screen === SCREEN.SSO_BUTTON) {
        return (
            <Form.Item>
                <Button
                    type="default"
                    onClick={() => setScreen(SCREEN.SSO_EMAIL)}
                    style={{ borderColor: '#3e82f7', color: "#3e82f7" }}
                    className="border-r-4 fw-b-5 full-width"
                >
                    Continue With SSO
                </Button>
            </Form.Item>
        )
    }

    if (screen === SCREEN.SSO_EMAIL) {
        return (
            <>
                <Form.Item>
                    <Input
                        type="email"
                        placeholder="Enter your SSO email"
                        value={ssoEmail}
                        onChange={(e) => setSSOEmail(e.target.value)}
                        onPressEnter={handleEmailContinue}
                        style={{ borderRadius: '4px', borderColor: '#3e82f7' }}
                    />
                </Form.Item>
                <Form.Item>
                    <Button
                        type="default"
                        onClick={handleEmailContinue}
                        loading={loading}
                        style={{ borderColor: '#3e82f7', color: "#3e82f7" }}
                        className="border-r-4 fw-b-5 full-width"
                    >
                        Continue With SSO
                    </Button>
                </Form.Item>
            </>
        )
    }

    if (screen === SCREEN.SSO_DOMAIN) {
        return (
            <div className="d-flex flex-column gap-2 mt-3">
                <label className="form-label small fw-medium text-dark mb-1">
                    Work Email Address*
                </label>
                <Input
                    type="email"
                    value={ssoEmail}
                    disabled
                    className="mb-3"
                />
                <div className="bg-white rounded-2 p-3" style={{ border: "2px solid #E8A000" }}>
                    <label className="form-label small fw-medium text-dark mb-1">
                        Enter Your Organization Domain*
                    </label>
                    <Input
                        type="text"
                        placeholder="e.g. contoso.onmicrosoft.com"
                        value={orgDomain}
                        onChange={(e) => setOrgDomain(e.target.value)}
                        onPressEnter={handleDomainContinue}
                        className="mb-2"
                    />
                    <button
                        type="button"
                        className="btn w-100 border-0 text-white fw-semibold"
                        style={{ background: "#E8A000", height: 44, borderRadius: 5 }}
                        onClick={handleDomainContinue}
                        disabled={loading}
                    >
                        {loading ? "Please wait..." : "Continue"}
                    </button>
                </div>
            </div>
        )
    }
}
