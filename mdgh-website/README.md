# Miss Diaspora Ghana (MDGH) Website

A complete pageantry website with admin dashboard for managing contestants, sponsorships, and content.

## Project Structure

```
mdgh-website/
├── public/                          # Public-facing website files
│   ├── index.html                   # Main website
│   └── admin.html                   # Admin dashboard
│
├── assets/                          # All website assets
│   ├── css/                         # Stylesheets
│   │   ├── styles.css               # Main site styles
│   │   └── admin.css                # Admin dashboard styles
│   │
│   ├── js/                          # JavaScript files
│   │   ├── script.js                # Main site functionality
│   │   └── admin.js                 # Admin dashboard logic
│   │
│   ├── images/                      # Image assets
│   │   ├── logos/                   # Brand logos and favicons
│   │   │   ├── mdgh main logo mini.png
│   │   │   ├── mdgh main logo.png
│   │   │   ├── md fav.png
│   │   │   ├── md fav 1024px.png
│   │   │   └── mdgh logo updated no bg.png
│   │   │
│   │   └── content/                 # Content images
│   │       ├── culture.png
│   │       ├── leadership.png
│   │       ├── social impact.png
│   │       ├── a-medium-shot-of-a-confident-elegant-gha.jpg
│   │       ├── a-photo-of-a-confident-elegant-ghanaian.jpeg
│   │       ├── mdgh contact.jpg
│   │       ├── mdgh socials.jpg
│   │       ├── mdgh sponsorship.jpg
│   │       ├── ghana-2.jpg
│   │       ├── ghana-2.webp
│   │       ├── images.jpg
│   │       ├── images (1).jpg
│   │       ├── images (2).jpg
│   │       ├── Miss-Ghana-2018.jpg
│   │       ├── main logo with bg.jpg
│   │       ├── mdgh logo temp.jpeg
│   │       ├── mdgh logo updated.jpg
│   │       └── mdgh logo.jpeg
│   │
│   └── videos/                      # Video assets
│       ├── mdgh intro vid.mp4       # Hero background video
│       ├── q1.mp4
│       ├── q1 (online-video-cutter.com).mp4
│       ├── q2.mp4
│       ├── q2 (online-video-cutter.com).mp4
│       ├── q3.mp4
│       ├── q3 (online-video-cutter.com).mp4
│       ├── q4.mp4
│       └── q4 (online-video-cutter.com).mp4
│
├── docs/                            # Documentation
│   ├── README.md                    # Original project overview
│   ├── ADMIN_README.md              # Admin dashboard guide
│   ├── EMAILJS_SETUP.md             # EmailJS configuration
│   ├── HOSTINGER_DEPLOYMENT.md      # Deployment instructions
│   └── UPLOAD_CHECKLIST.md          # File upload checklist
│
├── reference/                       # Reference files & exports
│   ├── MDGH SPONSORSHIP AND BENEFITS.pdf
│   ├── MDGH_Website_Enhancement_Proposal.pdf
│   ├── Divi_Persuasion_Talking_Points.pdf
│   ├── pdf_content.txt
│   ├── fluentform-export-mdgh-sponsor.json
│   ├── footer-elementor-640-2025-09-24.json
│   └── home-elementor-592-2025-09-24.json
│
├── .gitignore                       # Git ignore rules
└── MDGH - Project.code-workspace    # VS Code workspace config
```

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: CSS Variables, Flexbox, Grid
- **Email**: EmailJS integration
- **Storage**: Browser localStorage
- **Fonts**: Google Fonts (Playfair Display, Inter)

## Key Features

### Public Website (`public/index.html`)
- Hero section with background video
- Contestant gallery with filtering & search
- Sponsorship tiers
- Contact form with EmailJS
- Three pillars showcase
- Programs & initiatives
- Animated statistics
- Fully responsive design

### Admin Dashboard (`public/admin.html`)
- Secure login (default: admin/mdgh2025)
- Content management system
- Contestant CRUD operations
- Image & media management
- Sponsorship tier editing
- Settings & customization
- Preview functionality

## Getting Started

### Local Development
1. Open `public/index.html` in a web browser
2. Access admin at `public/admin.html`

### Admin Access
- **URL**: `public/admin.html`
- **Username**: `admin`
- **Password**: `mdgh2025`
- **⚠️ Change these credentials in `assets/js/admin.js`**

### Deployment to Hostinger

For detailed deployment instructions, see `docs/HOSTINGER_DEPLOYMENT.md`.

**Quick Deploy:**
1. Upload entire `public/` folder to `public_html/`
2. Upload `assets/` folder to `public_html/assets/`
3. Set file permissions: 644 (files), 755 (folders)
4. Configure EmailJS (see `docs/EMAILJS_SETUP.md`)
5. Test at your domain

**Important**: The admin dashboard path will be `yourdomain.com/admin.html`

## File Paths

All file paths in HTML files use relative paths:
- CSS: `../assets/css/`
- JavaScript: `../assets/js/`
- Images: `../assets/images/logos/` or `../assets/images/content/`
- Videos: `../assets/videos/`

## Configuration

### EmailJS Setup
See `docs/EMAILJS_SETUP.md` for complete setup instructions.

### Admin Credentials
Edit `assets/js/admin.js` lines 9-10 to change:
```javascript
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'mdgh2025';
```

## Documentation

- **Admin Guide**: `docs/ADMIN_README.md`
- **Deployment**: `docs/HOSTINGER_DEPLOYMENT.md`
- **Email Setup**: `docs/EMAILJS_SETUP.md`
- **Upload Checklist**: `docs/UPLOAD_CHECKLIST.md`

## Project Stats

- **Lines of Code**: ~6,396 total
- **HTML**: 1,069 lines (2 files)
- **CSS**: 3,332 lines (2 files)
- **JavaScript**: 1,995 lines (2 files)
- **Media Assets**: 28 files

## Support

For questions or issues:
1. Check documentation in `docs/` folder
2. Review browser console for errors
3. Verify all file paths are correct
4. Ensure EmailJS is configured properly

## License

Copyright © 2025 Miss Diaspora Ghana. All rights reserved.
