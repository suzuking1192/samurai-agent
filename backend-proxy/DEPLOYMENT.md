# Deployment Guide for Samurai Agent Beta Proxy

This guide covers deploying the Samurai Agent Beta Proxy to Render.com.

## Prerequisites

1. **Render.com Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Ensure your code is pushed to GitHub
3. **Environment Variables**: Have the required API keys ready

## Required Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `BETA_GEMINI_API_KEY` | Gemini API key for beta access | Yes | `AIzaSyABtXJC_UMtIw0SjJ7NABpL0PJAA2GmSHs` |
| `VALID_BETA_CODE` | Valid beta code for validation | Yes | `BETA-SA-2025-7K9M` |
| `NODE_ENV` | Environment mode | No | `production` |
| `PORT` | Server port | No | `3000` |

## Deployment Steps

### 1. Connect Repository

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository containing the backend-proxy code

### 2. Configure Service

1. **Name**: `samurai-agent-beta-proxy`
2. **Environment**: `Node`
3. **Region**: Choose closest to your users (e.g., Oregon)
4. **Branch**: `main` (or your deployment branch)
5. **Root Directory**: `backend-proxy`
6. **Build Command**: `npm install && npm run build`
7. **Start Command**: `npm start`

### 3. Set Environment Variables

In the Render dashboard, add the following environment variables:

```bash
NODE_ENV=production
BETA_GEMINI_API_KEY=your_actual_beta_gemini_api_key
VALID_BETA_CODE=BETA-SA-2025-7K9M
PORT=3000
```

**Important**: 
- Mark `BETA_GEMINI_API_KEY` as "Secret" in Render
- Do not commit the actual API key to your repository

### 4. Configure Health Check

1. **Health Check Path**: `/health`
2. **Health Check Timeout**: 30 seconds

### 5. Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy your service
3. Monitor the build logs for any issues

## Post-Deployment

### 1. Update VS Code Extension

After successful deployment, update the proxy URL in the VS Code extension:

**File**: `vscode/samurai-agent/src/common/constants/llm-constants.ts`

```typescript
export const GEMINI_BETA_PROXY_URL = 'https://your-actual-render-url.onrender.com/api/gemini-beta';
```

### 2. Test the Deployment

1. **Health Check**: Visit `https://your-service-url.onrender.com/health`
2. **API Test**: Use the `/api/gemini-beta/status` endpoint
3. **Integration Test**: Test with the VS Code extension

### 3. Monitor Logs

- Access logs in the Render dashboard
- Monitor for errors and performance issues
- Set up alerts for service downtime

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are in package.json
   - Review build logs for specific errors

2. **Environment Variable Issues**
   - Ensure all required variables are set
   - Check variable names match exactly
   - Verify secret variables are marked as such

3. **Health Check Failures**
   - Verify the health endpoint is accessible
   - Check if the service is binding to the correct port
   - Review application logs for startup errors

4. **API Errors**
   - Test the Gemini API key independently
   - Verify the beta code validation logic
   - Check CORS configuration if needed

### Logs and Debugging

```bash
# View build logs
# Available in Render dashboard under "Logs" tab

# Common log patterns to monitor:
# - "Server running on port 3000" - Successful startup
# - "Invalid beta code attempt" - Security events
# - "Gemini API error" - API integration issues
```

## Security Considerations

1. **API Key Protection**
   - Never commit API keys to version control
   - Use Render's secret environment variables
   - Rotate keys regularly

2. **Beta Code Validation**
   - Server-side validation prevents client-side bypass
   - Monitor for invalid beta code attempts
   - Consider rate limiting for repeated failures

3. **CORS Configuration**
   - Configure `ALLOWED_ORIGIN` for production
   - Restrict to known VS Code extension origins

## Scaling and Performance

### Render Plans

- **Starter**: Free tier, suitable for development
- **Standard**: $7/month, better performance and reliability
- **Pro**: $25/month, auto-scaling and advanced features

### Performance Optimization

1. **Connection Pooling**: Consider implementing for high traffic
2. **Caching**: Add response caching for repeated requests
3. **Rate Limiting**: Implement to prevent abuse
4. **Monitoring**: Set up performance monitoring

## Backup and Recovery

1. **Code Backup**: Ensure code is in version control
2. **Environment Backup**: Document all environment variables
3. **Database**: No persistent data, but monitor logs
4. **Disaster Recovery**: Document redeployment procedures

## Maintenance

### Regular Tasks

1. **Security Updates**: Keep dependencies updated
2. **API Key Rotation**: Rotate Gemini API keys periodically
3. **Log Monitoring**: Review logs for issues
4. **Performance Monitoring**: Monitor response times and errors

### Updates

1. **Code Updates**: Push to GitHub, Render auto-deploys
2. **Environment Changes**: Update in Render dashboard
3. **Dependency Updates**: Update package.json and redeploy

## Support

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Render Support**: Available through dashboard
- **Project Issues**: Use GitHub issues for code-related problems
