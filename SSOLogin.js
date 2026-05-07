import { Button, Form, Input, message } from "antd"
import { useState } from "react"

const SCREEN = {
    SSO_BUTTON: 'SSO_BUTTON',
    SSO_EMAIL: 'SSO_EMAIL',
    SSO_DOMAIN: 'SSO_DOMAIN',
}

export const SSOLogin = ({ handleSSORedirect }) => {
    const [screen, setScreen] = useState(SCREEN.SSO_BUTTON);
    const [ssoEmail, setSSOEmail] = useState("");
    const [orgDomain, setOrgDomain] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchSSOConfig = async (payload) => {
        const response = await fetch("http://localhost:3000/auth/domain-check", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.json();
    }

    const handleEmailContinue = async () => {
        setLoading(true);
        try {
            const data = await fetchSSOConfig({ email: ssoEmail });

            if (data.found) {
                handleSSORedirect(data); // redirect to SSO
            } else if (data.promptOrgDomain) {
                setScreen(SCREEN.SSO_DOMAIN); // show domain input
            } else {
                message.error(data.error?.message || 'SSO not configured for this email');
            }
        } catch (err) {
            message.error('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    const handleDomainContinue = async () => {
        setLoading(true);
        try {
            const data = await fetchSSOConfig({ domain: orgDomain });

            if (data.found) {
                handleSSORedirect(data); // redirect to SSO
            } else {
                message.error('SSO not configured for this domain');
            }
        } catch (err) {
            message.error('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // Screen 1: Just the button
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

    // Screen 2: Email input
    if (screen === SCREEN.SSO_EMAIL) {
        return (
            <>
                <Form.Item>
                    <Input
                        type="email"
                        placeholder="Enter your SSO email"
                        value={ssoEmail}
                        onChange={(e) => setSSOEmail(e.target.value)}
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

    // Screen 3: Domain input (shown when email domain not found)
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
