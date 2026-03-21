# Production Auth Setup

Use this checklist to finish production login setup for:

- Live site: https://dazzledivasinspectionchecklist.pages.dev/
- Convex production URL: https://stoic-dinosaur-501.convex.cloud

## 1. Cloudflare Pages Environment Variable

In Cloudflare Pages, confirm this variable is set:

- Name: VITE_CONVEX_URL
- Type: Text
- Value: https://stoic-dinosaur-501.convex.cloud

## 2. Convex Production Environment Variables

In the Convex dashboard for the stoic-dinosaur-501 production deployment, add these variables:

### SITE_URL

- Type: Text
- Value: https://dazzledivasinspectionchecklist.pages.dev/

### JWT_PRIVATE_KEY

- Type: Secret
- Value: paste the full contents of jwt_private_key.pem

Important:

- Include the full PEM exactly as generated
- Keep -----BEGIN PRIVATE KEY-----
- Keep -----END PRIVATE KEY-----

### JWKS

- Type: Secret
- Value: paste the full contents of jwks.json

Do not add CONVEX_SITE_URL.

## 3. Generate the Auth Key Files

Run this from 3/packages/backend:

`powershell
@'
const fs = require("node:fs");
const { generateKeyPairSync } = require("node:crypto");
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

fs.writeFileSync(
  "jwt_private_key.pem",
  privateKey.export({ type: "pkcs8", format: "pem" }),
  "utf8"
);

fs.writeFileSync(
  "jwks.json",
  JSON.stringify({ keys: [{ use: "sig", ...publicKey.export({ format: "jwk" }) }] }),
  "utf8"
);
'@ | node -
`

After running it:

- open jwt_private_key.pem
- copy its full contents into Convex production JWT_PRIVATE_KEY
- open jwks.json
- copy its full contents into Convex production JWKS

## 4. Sign In

After saving the Convex variables, sign in with:

- Email: dazzle@dazzledivascleaning.com
- Password: Dazzle!Admin2026#Start

## 5. If Login Still Fails

Check these first:

- VITE_CONVEX_URL is set in Cloudflare Pages
- SITE_URL is set in Convex production
- JWT_PRIVATE_KEY was pasted as the full PEM
- JWKS was pasted as the full JSON string
- Cloudflare Pages was redeployed after env var updates
