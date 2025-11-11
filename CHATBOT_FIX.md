# Chatbot Fix - OpenRouter Model Error

## Problem Fixed
The chatbot was throwing an error: `Error: OpenRouter: No endpoints found for google/gemini-pro-1.5`

## Solution
Changed the model name from `google/gemini-pro-1.5` to `google/gemini-flash-1.5`, which is a valid model on OpenRouter.

## Changes Made
- **File**: `mdgh-astro/src/pages/api/chat.ts`
- **Line 89**: Changed model from `google/gemini-pro-1.5` to `google/gemini-flash-1.5`
- **Line 18**: Improved API key handling with fallback support

## Alternative Models Available
If `google/gemini-flash-1.5` doesn't work, you can try these alternatives:
- `google/gemini-pro` - Standard Gemini Pro model
- `google/gemini-2.0-flash-exp` - Experimental Gemini 2.0 Flash
- `google/gemini-flash-1.5-8b` - Smaller, faster version

To change the model, edit `mdgh-astro/src/pages/api/chat.ts` line 89.

## Setting Up OpenRouter API Key

### For Cloudflare Pages Deployment:
1. Go to Cloudflare Pages dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add variable:
   - **Name**: `OPENROUTER_API_KEY`
   - **Value**: Your OpenRouter API key
5. Redeploy your site

### Get OpenRouter API Key:
1. Visit https://openrouter.ai/
2. Sign up or log in
3. Go to **Keys** section
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

## Testing the Chatbot

1. Deploy your changes to Cloudflare Pages
2. Visit your website
3. Click the chat button (bottom-right)
4. Type a message like "Tell me about MDGH"
5. The chatbot should respond without errors

## Troubleshooting

### Still Getting Model Errors?
- Check OpenRouter's model list: https://openrouter.ai/models
- Verify the model name is exactly as shown (case-sensitive)
- Try one of the alternative models listed above

### API Key Not Working?
- Verify the key is set in Cloudflare environment variables
- Check that the variable name is exactly `OPENROUTER_API_KEY`
- Ensure you've redeployed after adding the environment variable

### Other Errors?
- Check browser console for detailed error messages
- Verify your OpenRouter account has credits/quota
- Check Cloudflare Pages logs for server-side errors

## Model Comparison

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `google/gemini-flash-1.5` | ⚡ Fast | ⭐⭐⭐⭐ Good | 💰 Low |
| `google/gemini-pro` | 🐢 Slower | ⭐⭐⭐⭐⭐ Excellent | 💰💰 Medium |
| `google/gemini-2.0-flash-exp` | ⚡⚡ Very Fast | ⭐⭐⭐⭐⭐ Excellent | 💰 Low |

**Recommendation**: `google/gemini-flash-1.5` is the best balance of speed, quality, and cost for a chatbot.

