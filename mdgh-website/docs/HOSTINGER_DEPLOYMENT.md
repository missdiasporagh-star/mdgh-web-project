# Hostinger Deployment Guide for MDGH Website

## Overview
This guide will help you deploy the MDGH website to Hostinger hosting.

## Prerequisites
- Hostinger account and hosting plan
- Access to Hostinger control panel (hPanel)
- All website files ready

## Step-by-Step Deployment Process

### Method 1: Using Hostinger File Manager (Easiest)

#### Step 1: Access File Manager
1. Log in to your Hostinger account
2. Go to **hPanel** (Hostinger Control Panel)
3. Navigate to **Files** → **File Manager**
4. Open the `public_html` folder (this is your website's root directory)

#### Step 2: Upload Files
1. In File Manager, click **Upload** button
2. Select **ALL** the following files and folders:
   - `index.html`
   - `admin.html`
   - `styles.css`
   - `admin.css`
   - `script.js`
   - `admin.js`
   - All image files (`.jpg`, `.png`, `.jpeg`)
   - All video files (`.mp4`)
   - All PDF files (if needed)
   - `README.md` (optional)
   - `ADMIN_README.md` (optional)
   - `EMAILJS_SETUP.md` (optional)

3. **Important**: Upload all files to the `public_html` directory
4. Wait for upload to complete

#### Step 3: Verify File Structure
Your `public_html` should contain:
```
public_html/
├── index.html
├── admin.html
├── styles.css
├── admin.css
├── script.js
├── admin.js
├── mdgh main logo mini.png
├── mdgh main logo.png
├── md fav.png
├── a-medium-shot-of-a-confident-elegant-gha.jpg
├── culture.png
├── leadership.png
├── social impact.png
├── mdgh intro vid.mp4
└── ... (all other images and assets)
```

### Method 2: Using FTP (Faster for Large Files)

#### Step 1: Get FTP Credentials
1. In hPanel, go to **Files** → **FTP Accounts**
2. Note down or create FTP credentials:
   - **FTP Host**: Usually `ftp.yourdomain.com` or your server IP
   - **FTP Username**: Your FTP username
   - **FTP Password**: Your FTP password
   - **Port**: Usually `21` (or `22` for SFTP)

#### Step 2: Connect with FTP Client
**Option A: Using FileZilla (Recommended)**
1. Download FileZilla: https://filezilla-project.org/
2. Open FileZilla
3. Enter FTP credentials:
   - Host: `ftp.yourdomain.com`
   - Username: Your FTP username
   - Password: Your FTP password
   - Port: `21`
4. Click **Quickconnect**

**Option B: Using Windows File Explorer**
1. Open File Explorer
2. Type: `ftp://ftp.yourdomain.com` in address bar
3. Enter FTP credentials when prompted

#### Step 3: Upload Files
1. Navigate to `public_html` folder on server
2. Select all local files
3. Drag and drop to `public_html` folder
4. Wait for upload to complete

### Method 3: Using Git (If Hostinger Supports Git)

#### Step 1: Enable Git in Hostinger
1. In hPanel, go to **Advanced** → **Git**
2. Enable Git if available
3. Clone your repository:
   ```bash
   git clone https://github.com/ghwmelite-dotcom/mdgh-web-project.git
   ```

## Important Configuration Steps

### 1. Set Default Pages
1. In hPanel, go to **Files** → **File Manager**
2. Click **Settings** (gear icon)
3. Ensure `index.html` is listed as default page

### 2. File Permissions
1. Select all files in `public_html`
2. Right-click → **Change Permissions**
3. Set to:
   - Files: `644`
   - Folders: `755`

### 3. Check Domain Settings
1. In hPanel, go to **Domains**
2. Ensure your domain is pointing to `public_html`
3. SSL certificate should be enabled (Let's Encrypt is free)

## Testing Your Website

### Main Website
1. Visit: `https://yourdomain.com` or `https://yourdomain.com/index.html`
2. Check:
   - Logo displays correctly
   - Images load properly
   - Videos play
   - All sections are visible
   - Contact form works

### Admin Dashboard
1. Visit: `https://yourdomain.com/admin.html`
2. Test login with:
   - Username: `admin`
   - Password: `mdgh2025`
3. Verify all functions work

## Troubleshooting

### Images Not Loading
- Check file paths are correct (case-sensitive)
- Verify images are uploaded to `public_html`
- Check file permissions (should be 644)

### CSS/JS Not Loading
- Clear browser cache (Ctrl+F5)
- Check browser console for errors
- Verify file paths in HTML are correct

### Admin Dashboard Not Working
- Check browser console for JavaScript errors
- Verify `admin.js` and `admin.css` are uploaded
- Ensure localStorage is enabled in browser

### Video Not Playing
- Check video file size (may need compression)
- Verify video format (MP4 recommended)
- Check file permissions

## Post-Deployment Checklist

- [ ] Main website loads correctly
- [ ] All images display properly
- [ ] Navigation links work
- [ ] Contact form submits successfully
- [ ] Admin dashboard accessible
- [ ] Admin login works
- [ ] SSL certificate active (HTTPS)
- [ ] Mobile responsive design works
- [ ] Video background plays
- [ ] All sections scroll smoothly

## EmailJS Configuration

If you haven't already set up EmailJS:
1. Go to EmailJS Dashboard: https://dashboard.emailjs.com/
2. Complete setup (see `EMAILJS_SETUP.md`)
3. Update `script.js` with your Service ID and Template ID

## Security Recommendations

1. **Change Admin Credentials**: 
   - Edit `admin.js` line 9-10
   - Change default username/password

2. **Protect Admin Directory** (Optional):
   - Create `.htaccess` file in `public_html`
   - Add authentication for admin folder

3. **Enable HTTPS**:
   - Ensure SSL certificate is active
   - Force HTTPS redirect if needed

## File Upload Checklist

Make sure these files are uploaded:
- ✅ index.html
- ✅ admin.html
- ✅ styles.css
- ✅ admin.css
- ✅ script.js
- ✅ admin.js
- ✅ mdgh main logo mini.png
- ✅ mdgh main logo.png
- ✅ md fav.png
- ✅ All image files (.jpg, .png, .jpeg)
- ✅ mdgh intro vid.mp4
- ✅ culture.png
- ✅ leadership.png
- ✅ social impact.png
- ✅ a-medium-shot-of-a-confident-elegant-gha.jpg
- ✅ All other assets

## Need Help?

If you encounter issues:
1. Check Hostinger documentation
2. Contact Hostinger support
3. Review browser console for errors
4. Verify all files uploaded correctly

---

**Note**: After deployment, test thoroughly on multiple devices and browsers to ensure everything works correctly.

