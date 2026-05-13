
import { Button, Form, Input, message } from "antd"
import { useState } from "react"

const SCREEN = {
    SSO_BUTTON: 'SSO_BUTTON',
    SSO_EMAIL: 'SSO_EMAIL',
    SSO_DOMAIN: 'SSO_DOMAIN',
}

const triggerSSORedirect = async (data) => {
    if (data.protocol === "saml") {
        window.location.href = data.redirectUrl;
        return;
    }

    if (data.protocol !== "oidc") {
        message.error("Unsupported SSO protocol. Please contact your administrator.");
        return;
    }

    const response = await fetch("http://localhost:5000/auth/domain-check", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            email: data.email,
            organizationName: data.organizationName || "",
        }),
    });

    const result = await response.json();
    console.log(result)
    if (!response.ok) {
        if (result.requiresOrganizationName) {
            throw new Error(result.error);
        }

        throw new Error(result.error || "Unable to start SSO sign-in");
    }

    const params = new URLSearchParams({
        client_id: result.clientId,
        response_type: result.responseType,
        redirect_uri: result.redirectUri,
        scope: result.scope,
        state: result.state,
        login_hint: result.loginHint,
    });

    if (result.codeChallenge && result.codeChallengeMethod) {
        params.set("code_challenge", result.codeChallenge);
        params.set("code_challenge_method", result.codeChallengeMethod);
    }

    window.location.href = `${result.authorizationEndpoint}?${params.toString()}`;
};

// const triggerSSORedirect = (data) => {
//     if (data.protocol === 'saml') {

//         // SAML: backend returns redirectUrl directly (not inside config)
//         window.location.href = data.redirectUrl;

//     } else if (data.protocol === 'oidc') {

//         // Generate state and nonce on the frontend (client_secret_post method)
//         const state = crypto.randomUUID();
//         const nonce = crypto.randomUUID();

//         // Save these to sessionStorage — needed at the callback page
//         sessionStorage.setItem('oidc_company_id', data.company_id);
//         sessionStorage.setItem('oidc_state', state);
//         sessionStorage.setItem('oidc_nonce', nonce);

//         const params = new URLSearchParams({
//             client_id: data.config.client_id,
//             response_type: 'code',
//             redirect_uri: data.config.redirect_uri,
//             scope: data.config.scope,
//             state,
//             nonce,
//         });

//         window.location.href = `${data.config.sso_url}?${params.toString()}`;

//     } else {
//         message.error('Unsupported SSO protocol. Please contact your administrator.');
//     }
// };

const fetchSSOConfig = async (payload) => {
    let response;

    try {
        response = await fetch("http://localhost:5000/auth/domain-check", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
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
            console.log("SSO Config => ", data)
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
https://login.microsoftonline.com/2c761afb-5a70-452a-ab62-b98b90a6e556/oauth2/v2.0/authorize?client_id=e2973f68-2627-45f1-9417-84265f3648b1&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Foidc%2Fcallback&scope=openid+profile+email+groups&state=260b9021-ea6e-49ac-bda5-ef324d966b75&nonce=b3b8130b-389f-433e-ab2e-85749c60c4fa
