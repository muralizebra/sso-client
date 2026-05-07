import { Button, Form, Input } from "antd"
import { useState } from "react"
export const SSOLogin = ({ handleSSORedirect }) => {
    const [ssoLoginEnabled, setSSOLoginEnabled] = useState(false);
    const [ssoEmail, setSSOEmail] = useState("");

    const getSSOConfig = async () => {
        console.log("getSSOConfig Called !!", ssoEmail)
        const response = await fetch("http://localhost:5000/auth/domain-check", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ssoEmail })
        })
        const data = await response.json();
        console.log(data)
    }
    return <>

        {ssoLoginEnabled ?
            <>
                <Form.Item>
                    <Input
                        type="email"
                        placeholder="Enter your SSO email"
                        value={ssoEmail}
                        style={{ borderRadius: '4px', borderColor: '#3e82f7', }}
                        onChange={(e) => setSSOEmail(e.target.value)}
                    />
                </Form.Item>
                <Form.Item>
                    <Button
                        type="default"
                        htmlType="button"
                        onClick={() => getSSOConfig()}
                        className={
                            'border-r-4 fw-b-5 full-width'
                        }
                        style={{
                            borderColor: '#3e82f7',
                            color: "#3e82f7"
                        }}
                    >
                        Continue With SSO
                    </Button>

                </Form.Item>
            </> : <Form.Item>
                <Button
                    type="default"
                    htmlType="button"
                    onClick={() => setSSOLoginEnabled(true)}
                    className={
                        'border-r-4 fw-b-5 full-width'
                    }
                    style={{
                        borderColor: '#3e82f7',
                        color: "#3e82f7"
                    }}
                >
                    Continue With SSO
                </Button>

            </Form.Item>


        }

    {screen === SCREEN.SSO_DOMAIN && (
                                <div className="d-flex flex-column gap-2 mt-3">
                                    <label className="form-label small fw-medium text-dark mb-1">
                                        Work Email Address*
                                    </label>
                                    <Input
                                        type="email"
                                        placeholder="Enter your work email"
                                        value={workEmail}
                                        onChange={(e) => setWorkEmail(e.target.value)}
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
                                            onClick={handleSSODomainContinue}
                                            disabled={loading}
                                        >
                                            {loading ? "Please wait..." : "Continue"}
                                        </button>
                                    </div>
                                 
                                </div>
                            )}
    </>

}
