# MDGH Admin Dashboard

A comprehensive Content Management System (CMS) for managing all aspects of the Miss Diaspora Ghana website.

## Features

### 🎯 Complete Content Management
- **General Settings**: Site title, description, logo, favicon, brand colors
- **Hero Section**: Edit main hero content, buttons, and background video
- **Navigation**: Add, edit, or remove navigation menu items
- **Page Content**: Edit About section, objectives, programs
- **Images & Media**: Upload and manage images throughout the site
- **Footer**: Customize footer content and links
- **Sponsorship**: Edit sponsorship tiers, pricing, and benefits
- **Contestants**: Full CRUD operations for contestant profiles

### 🔐 Security
- Login authentication system
- Session management (24-hour sessions)
- Optional "Remember Me" functionality
- Default credentials can be changed after first login

### 💾 Data Storage
- Uses localStorage for content storage
- Changes persist across browser sessions
- Preview functionality to see changes before publishing

## Getting Started

### Accessing the Dashboard

1. Open `admin.html` in your web browser
2. Use the default credentials:
   - **Username**: `admin`
   - **Password**: `mdgh2025`
3. ⚠️ **Important**: Change these credentials after your first login!

### Changing Login Credentials

After logging in, you can change credentials by modifying the `CONFIG` object in `admin.js`:

```javascript
const CONFIG = {
    defaultUsername: 'your_new_username',
    defaultPassword: 'your_new_password',
    // ...
};
```

Or implement a credentials update feature in the admin dashboard.

## How to Use

### 1. Editing Content

1. Navigate to the appropriate section using the sidebar menu
2. Edit any field you want to change
3. Changes are tracked automatically
4. Click **"Save All Changes"** when ready to apply

### 2. Adding Navigation Items

1. Go to **Navigation** section
2. Click **"+ Add Menu Item"**
3. Enter the menu text and link (e.g., `#section`)
4. Click **"Save All Changes"**

### 3. Managing Contestants

1. Go to **Contestants** section
2. Click **"+ Add New Contestant"**
3. Fill in all required fields:
   - Name, Location, Cause, Category
   - Bio, Achievements
   - Social media links (optional)
   - Stats (Projects, Impact)
4. Upload an image or enter image filename
5. Click **"Save Contestant"**
6. Click **"Save All Changes"** to apply to the main site

### 4. Editing Sponsorship Tiers

1. Go to **Sponsorship** section
2. Edit tier names, prices, and benefits
3. Add or remove benefits as needed
4. Click **"Save All Changes"**

### 5. Uploading Images

1. Navigate to **Images & Media** or relevant section
2. Click **"Change Logo"**, **"Change Favicon"**, or upload button
3. Select your image file
4. Preview will update immediately
5. Click **"Save All Changes"** to apply

### 6. Previewing Changes

1. Click **"Preview Site"** button (top right)
2. This opens the main site in a new tab
3. Your saved changes will be visible if localStorage is shared

## Technical Details

### File Structure

```
MDGH/
├── admin.html          # Admin dashboard HTML
├── admin.css           # Admin dashboard styles
├── admin.js            # Admin dashboard functionality
├── index.html          # Main website
├── styles.css          # Main website styles
└── script.js           # Main website scripts (includes admin content loader)
```

### How It Works

1. **Admin Dashboard** (`admin.html`):
   - Provides a user-friendly interface for editing content
   - Stores changes in localStorage under `mdgh_site_content`
   - Stores contestants separately under `mdgh_contestants`

2. **Main Website** (`index.html`):
   - Loads content from localStorage on page load
   - Falls back to default content if no admin content exists
   - Updates all relevant elements dynamically

### Data Storage

Content is stored in browser localStorage:

```javascript
// Site content
localStorage.setItem('mdgh_site_content', JSON.stringify(content));

// Contestants
localStorage.setItem('mdgh_contestants', JSON.stringify(contestants));

// Authentication
localStorage.setItem('mdgh_admin_auth', 'true');
localStorage.setItem('mdgh_admin_timestamp', Date.now().toString());
```

### Supported Content Types

- **Text**: All text content across the site
- **Colors**: Primary and secondary brand colors
- **Images**: Logo, favicon, hero background, content images
- **Videos**: Hero background video
- **Navigation**: Menu items and links
- **Footer**: Copyright text, organization info, links
- **Sponsorship**: Tiers, pricing, benefits
- **Contestants**: Full profiles with images, bio, achievements, stats

## Limitations & Future Enhancements

### Current Limitations

1. **LocalStorage Only**: Content is stored in browser localStorage, so it's browser-specific
2. **No Backend**: No server-side storage or API integration
3. **No Image Upload Server**: Images must be manually uploaded to the server directory
4. **No Multi-user**: Single admin account

### Recommended Enhancements

1. **Backend Integration**: Connect to a backend API/database
2. **File Upload**: Implement server-side image upload
3. **User Management**: Support multiple admin users with roles
4. **Version Control**: Track changes and enable rollback
5. **Export/Import**: Export content as JSON for backup
6. **SEO Settings**: Advanced SEO meta tags management
7. **Analytics**: Integration with analytics tools

## Troubleshooting

### Changes Not Appearing

1. Ensure you clicked **"Save All Changes"**
2. Check browser console for errors
3. Clear browser cache and reload
4. Verify localStorage is enabled in browser

### Can't Login

1. Check if credentials are correct (default: `admin` / `mdgh2025`)
2. Clear browser localStorage and try again
3. Check browser console for errors

### Images Not Loading

1. Ensure image files are in the correct directory
2. Check image filenames match exactly (case-sensitive)
3. Verify image paths are correct

## Security Notes

⚠️ **Important Security Considerations**:

1. **Change Default Credentials**: Always change default login credentials
2. **LocalStorage Limitations**: Content is stored client-side only
3. **No Server Validation**: Consider adding server-side validation in production
4. **HTTPS**: Use HTTPS in production to protect credentials
5. **Backup**: Regularly backup your content/data

## Support

For issues or questions, refer to the main project documentation or contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: 2025

