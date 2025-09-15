export async function sendLogInRequest() {
  const url = "http://localhost:3003/accounts/api/auth/ext-login";

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Application-ID": "ewe-test-portal-client",
  };

  const body = JSON.stringify({
    otp: "portal-test-otp",
    email: "ewe-test@functional.com",
    clientId: "ewe-test-portal-client",
  });

  await fetch(url, {
    method: "POST",
    headers,
    body,
  });
}

sendLogInRequest();
