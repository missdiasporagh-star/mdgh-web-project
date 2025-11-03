# EmailJS Setup Guide for MDGH Contact Form

## Quick Setup Steps

### 1. Create EmailJS Account
1. Go to https://www.emailjs.com/
2. Sign up for a free account (free tier allows 200 emails/month)
3. Verify your email address

### 2. Create an Email Service
1. In EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail recommended)
4. Follow the connection instructions
5. **Save your Service ID** (e.g., `service_abc123`)

### 3. Create an Email Template
1. Go to **Email Templates** in dashboard
2. Click **Create New Template**
3. Use this template structure:

**Template Name**: MDGH Contact Form

**Subject**: 
```
New Contact Form Submission - {{subject}}
```

**Content**:
```
From: {{from_name}}
Email: {{from_email}}
Phone: {{phone}}

Subject: {{subject}}

Message:
{{message}}

---
This email was sent from the MDGH website contact form.
Reply to: {{reply_to}}
```

4. **Save your Template ID** (e.g., `template_xyz789`)

### 4. Get Your Public Key
1. Go to **Account** → **General**
2. Find your **Public Key** (e.g., `abcdefghijklmnop`)
3. Copy this key

### 5. Update the JavaScript File
Open `script.js` and replace these three values:

**Line 114**: Replace `YOUR_PUBLIC_KEY` with your Public Key
```javascript
emailjs.init("YOUR_PUBLIC_KEY"); // Replace with your actual Public Key
```

**Line 232**: Replace `YOUR_SERVICE_ID` with your Service ID
```javascript
'YOUR_SERVICE_ID',      // Replace with your EmailJS Service ID
```

**Line 233**: Replace `YOUR_TEMPLATE_ID` with your Template ID
```javascript
'YOUR_TEMPLATE_ID',     // Replace with your EmailJS Template ID
```

### Example:
```javascript
emailjs.init("abcdefghijklmnop"); // Your Public Key

const response = await emailjs.send(
    'service_abc123',      // Your Service ID
    'template_xyz789',     // Your Template ID
    {
        // ... rest of the code
    }
);
```

## Testing
1. Open the website in your browser
2. Navigate to the Contact section
3. Fill out the form
4. Submit and check your email inbox
5. You should receive the form submission email

## Form Features Included
✅ Real-time validation
✅ Character counter (1000 limit)
✅ Loading spinner during submission
✅ Success/error messages
✅ Required field indicators
✅ Consent checkbox
✅ Responsive design
✅ EmailJS integration

## Troubleshooting
- **Form not sending**: Check browser console for errors
- **Email not received**: Verify EmailJS service is connected correctly
- **Template issues**: Ensure template variables match the code ({{from_name}}, etc.)

## Security Note
EmailJS Public Key is safe to expose in frontend code. Never share your Private Key or Service/Template IDs publicly.

