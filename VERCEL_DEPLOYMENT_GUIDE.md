# Deploying Your Next.js Frontend to Vercel

This guide will walk you through deploying your Next.js application (located in the `frontend` subdirectory) to Vercel.

## Prerequisites

*   Your Next.js application code, including the `frontend` directory, pushed to a Git repository (GitHub, GitLab, or Bitbucket).
*   An account with Auth0, with an Application configured for your Next.js app.
*   Your backend (e.g., the auction service API) deployed and its base URL accessible (e.g., an AWS API Gateway URL).

## Deployment Steps

1.  **Push Your Code:**
    *   Ensure your latest code, including all contents of the `frontend` directory and any recent changes (like the `.env.local` file for local development, though Vercel will use its own environment variable system), is committed and pushed to your main branch on GitHub, GitLab, or Bitbucket.

2.  **Sign Up/Log In to Vercel:**
    *   Go to [vercel.com](https://vercel.com/).
    *   Sign up for a new account or log in if you already have one. Using your Git provider (GitHub, GitLab, Bitbucket) for signup/login is often the easiest.

3.  **Create a New Vercel Project:**
    *   Once logged in, click the "Add New..." button and select "Project".
    *   **Import Git Repository:** Choose the Git provider where your code is hosted and select your repository. Vercel will need access to your repositories.

4.  **Configure Vercel Project Settings:**
    *   **Framework Preset:** Vercel should automatically detect "Next.js" as the framework. If not, you can select it manually.
    *   **Root Directory:** This is a crucial step.
        *   Click to expand the "Root Directory" setting.
        *   Set it to `frontend`. This tells Vercel that your Next.js application is located in the `frontend` subdirectory of your repository.
    *   **Build and Output Settings:** These are usually auto-detected for Next.js and typically don't need changes (`npm run build` or `next build`).
        *   Install Command: `npm install` (or `yarn install` if you use Yarn) should also be fine. Vercel usually handles this automatically based on your `package-lock.json` or `yarn.lock`.

5.  **Add Environment Variables:**
    *   This is the most critical configuration step for your application to run correctly.
    *   In your Vercel project settings, navigate to the "Environment Variables" section.
    *   Add the following variables one by one:

        *   `AUTH0_SECRET`:
            *   **Value:** Generate a long, random, and strong secret string. You can use a password generator or a command like `openssl rand -hex 32` in your terminal. This is used by Auth0 to sign and encrypt session cookies.
        *   `AUTH0_BASE_URL`:
            *   **Value:** This will be your Vercel deployment's URL. Vercel provides system environment variables for this. You can often use `https://your-project-name.vercel.app` (replace `your-project-name` with what Vercel assigns or what you configure as your domain). Vercel also exposes `VERCEL_URL` which can be used, but for Auth0, an absolute URL is generally more reliable, especially for the initial setup. **Important:** After your first deployment, Vercel will give you the primary URL for your project. You might need to update this variable to that specific URL if you used a placeholder initially.
        *   `AUTH0_ISSUER_BASE_URL`:
            *   **Value:** Your Auth0 tenant domain. Example: `https://your-tenant-name.auth0.com` (replace `your-tenant-name` with your actual Auth0 tenant name).
        *   `AUTH0_CLIENT_ID`:
            *   **Value:** Your Auth0 Application's Client ID. Find this in your Auth0 Application settings.
        *   `AUTH0_CLIENT_SECRET`:
            *   **Value:** Your Auth0 Application's Client Secret. Find this in your Auth0 Application settings. This is sensitive; ensure it's kept secure.
        *   `NEXT_PUBLIC_API_BASE_URL`:
            *   **Value:** The full base URL of your deployed backend API (e.g., your AWS API Gateway stage URL for the auction service). Example: `https://xxxxxxxxx.execute-api.your-region.amazonaws.com/dev`.

    *   **Note on `NEXT_PUBLIC_` prefix:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser-side JavaScript. Ensure no sensitive secrets are prefixed with `NEXT_PUBLIC_` unless they are explicitly meant to be public. `NEXT_PUBLIC_API_BASE_URL` is okay as it just points to your API.

6.  **Trigger Deployment:**
    *   After configuring the root directory and environment variables, click the "Deploy" button.
    *   Vercel will start building and deploying your application. You can monitor the build logs in the Vercel dashboard.
    *   Once the deployment is complete, Vercel will provide you with a live URL (e.g., `your-project-name.vercel.app`). Click this URL to visit your deployed site.

7.  **Automatic Deployments (Git Integration):**
    *   Once your project is imported and deployed, Vercel will automatically build and deploy new versions of your site whenever you push new commits to your connected Git repository's main branch (or other configured production/preview branches). This makes updates seamless.

## Important Considerations:

*   **Auth0 Callback URLs:** Ensure your Auth0 Application settings have the Vercel deployment URL(s) added to the "Allowed Callback URLs", "Allowed Logout URLs", and "Allowed Web Origins" fields.
    *   Example Callback URL: `https://your-project-name.vercel.app/api/auth/callback`
    *   Example Logout URL: `https://your-project-name.vercel.app/`
*   **Custom Domains:** If you have a custom domain, you can configure it in your Vercel project settings under the "Domains" tab. If you use a custom domain, remember to update `AUTH0_BASE_URL` and your Auth0 Application URLs accordingly.
*   **Troubleshooting:** If your deployment fails or the site doesn't work as expected, check the build logs and runtime logs in the Vercel dashboard for errors. Common issues often relate to incorrect environment variables or Root Directory settings.

That's it! Your Next.js frontend should now be live on Vercel.
