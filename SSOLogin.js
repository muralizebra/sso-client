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


    </>

}
