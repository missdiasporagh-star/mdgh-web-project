// Admin Dashboard JavaScript
(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        defaultUsername: 'admin',
        defaultPassword: 'mdgh2025',
        storageKey: 'mdgh_admin_data',
        siteIndexPath: 'index.html'
    };

    // State Management
    let adminState = {
        loggedIn: false,
        siteContent: {},
        contestants: []
    };

    // Initialize Admin Dashboard
    function init() {
        checkAuth();
        setupEventListeners();
        loadSiteContent();
        populateAdminForms();
    }

    // Authentication
    function checkAuth() {
        const savedAuth = localStorage.getItem('mdgh_admin_auth');
        const savedTimestamp = localStorage.getItem('mdgh_admin_timestamp');
        
        if (savedAuth === 'true' && savedTimestamp) {
            const hoursPassed = (Date.now() - parseInt(savedTimestamp)) / (1000 * 60 * 60);
            if (hoursPassed < 24) { // Session expires after 24 hours
                adminState.loggedIn = true;
                showDashboard();
                return;
            }
        }
        
        showLogin();
    }

    function showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
    }

    function showDashboard() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
    }

    // Login Handler
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        // Get saved credentials or use defaults
        const savedCreds = JSON.parse(localStorage.getItem('mdgh_admin_credentials') || '{}');
        const validUsername = savedCreds.username || CONFIG.defaultUsername;
        const validPassword = savedCreds.password || CONFIG.defaultPassword;

        if (username === validUsername && password === validPassword) {
            adminState.loggedIn = true;
            localStorage.setItem('mdgh_admin_auth', 'true');
            localStorage.setItem('mdgh_admin_timestamp', Date.now().toString());
            if (rememberMe) {
                localStorage.setItem('mdgh_admin_remember', 'true');
            }
            showDashboard();
        } else {
            alert('Invalid username or password');
        }
    });

    // Logout Handler
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('mdgh_admin_auth');
            localStorage.removeItem('mdgh_admin_timestamp');
            adminState.loggedIn = false;
            showLogin();
        }
    });

    // Load Site Content
    function loadSiteContent() {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) {
            adminState.siteContent = JSON.parse(saved);
        } else {
            // Initialize with default content from main site
            adminState.siteContent = getDefaultContent();
        }
    }

    function getDefaultContent() {
        return {
            siteTitle: 'Miss Diaspora Ghana | Celebrating Beauty, Culture & Impact',
            metaDescription: 'Miss Diaspora Ghana empowers young women of African descent to lead, serve, and connect Ghana with its global diaspora.',
            logo: 'mdgh main logo mini.png',
            favicon: 'md fav.png',
            primaryColor: '#F8B92F',
            secondaryColor: '#000000',
            hero: {
                title1: 'Celebrating Beauty,',
                title2: 'Culture & Impact',
                title3: 'Across the Diaspora',
                subtitle: 'MDGH empowers young women of African descent to lead, serve, and connect Ghana with its global diaspora.',
                btn1: 'Explore The Pageant',
                btn2: 'Become a Sponsor',
                video: 'mdgh intro vid.mp4'
            },
            navigation: [
                { text: 'Home', href: '#home' },
                { text: 'About', href: '#about' },
                { text: 'Objectives', href: '#objectives' },
                { text: 'Programs', href: '#programs' },
                { text: 'Contestants', href: '#contestants' },
                { text: 'Sponsorship', href: '#sponsorship' },
                { text: 'Contact', href: '#contact' }
            ],
            about: {
                title: 'About Miss Diaspora GH',
                desc1: 'Miss Diaspora Ghana (MDGH) is dedicated to celebrating the beauty and strength of women of African descent. Our mission empowers young leaders to connect with their roots and make a difference.',
                desc2: 'Motivated by the rich heritage and cultural legacy of Ghana, we seek to bridge the gap between the diaspora and their homeland through leadership and empowerment.',
                image: 'a-medium-shot-of-a-confident-elegant-gha.jpg'
            },
            footer: {
                copyright: '© 2025 Miss Diaspora Ghana (MDGH). All rights reserved.',
                organization: 'An initiative of Nubian Crown Company Limited.',
                links: [
                    { text: 'Home', href: '#home' },
                    { text: 'About', href: '#about' },
                    { text: 'Sponsorship', href: '#sponsorship' },
                    { text: 'Contact', href: '#contact' }
                ]
            }
        };
    }

    // Setup Event Listeners
    function setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                switchSection(section);
            });
        });

    // Save Button
    const saveBtn = document.getElementById('saveAllBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveAllChanges();
        });
    }

        // Preview Button
        document.getElementById('previewBtn')?.addEventListener('click', () => {
            window.open(CONFIG.siteIndexPath, '_blank');
        });

        // Image Upload Handlers
        setupImageUploads();

        // Auto-save on input changes
        setupAutoSave();

        // Contestant Management
        setupContestantManagement();

        // Add Navigation Item Button
        document.getElementById('addNavItem')?.addEventListener('click', () => {
            if (!adminState.siteContent.navigation) {
                adminState.siteContent.navigation = [];
            }
            adminState.siteContent.navigation.push({ text: '', href: '' });
            populateNavigation();
        });

        // Add Footer Link Button
        document.getElementById('addFooterLink')?.addEventListener('click', () => {
            if (!adminState.siteContent.footer) {
                adminState.siteContent.footer = {};
            }
            if (!adminState.siteContent.footer.links) {
                adminState.siteContent.footer.links = [];
            }
            adminState.siteContent.footer.links.push({ text: '', href: '' });
            populateFooter();
        });
    }

    function switchSection(sectionId) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

        // Update sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId)?.classList.add('active');
    }

    // Populate Admin Forms
    function populateAdminForms() {
        const content = adminState.siteContent;

        // General Settings
        if (content.siteTitle) {
            document.getElementById('siteTitle').value = content.siteTitle;
        }
        if (content.metaDescription) {
            document.getElementById('siteDescription').value = content.metaDescription;
        }
        if (content.primaryColor) {
            document.getElementById('primaryColor').value = content.primaryColor;
        }
        if (content.secondaryColor) {
            document.getElementById('secondaryColor').value = content.secondaryColor;
        }

        // Hero Section
        if (content.hero) {
            document.getElementById('heroTitle1').value = content.hero.title1 || '';
            document.getElementById('heroTitle2').value = content.hero.title2 || '';
            document.getElementById('heroTitle3').value = content.hero.title3 || '';
            document.getElementById('heroSubtitle').value = content.hero.subtitle || '';
            document.getElementById('heroBtn1').value = content.hero.btn1 || '';
            document.getElementById('heroBtn2').value = content.hero.btn2 || '';
            document.getElementById('heroVideo').value = content.hero.video || '';
        }

        // About Section
        if (content.about) {
            document.getElementById('aboutTitle').value = content.about.title || '';
            document.getElementById('aboutDesc1').value = content.about.desc1 || '';
            document.getElementById('aboutDesc2').value = content.about.desc2 || '';
            document.getElementById('aboutImage').value = content.about.image || '';
        }

        // Navigation
        populateNavigation();
        
        // Footer
        populateFooter();

        // Sponsorship Tiers
        populateSponsorshipTiers();

        // Contestants
        populateContestants();
    }

    function populateNavigation() {
        const navList = document.getElementById('navItemsList');
        if (!navList) return;

        navList.innerHTML = '';
        const navItems = adminState.siteContent.navigation || [];

        navItems.forEach((item, index) => {
            const navItem = createNavItemElement(item, index);
            navList.appendChild(navItem);
        });
    }

    function createNavItemElement(item, index) {
        const div = document.createElement('div');
        div.className = 'nav-item-admin';
        div.innerHTML = `
            <input type="text" class="nav-text" value="${item.text}" data-index="${index}" placeholder="Menu Text">
            <input type="text" class="nav-href" value="${item.href}" data-index="${index}" placeholder="#section">
            <button type="button" class="btn-remove" onclick="removeNavItem(${index})">Remove</button>
        `;
        return div;
    }

    function populateFooter() {
        const footerList = document.getElementById('footerLinksList');
        if (!footerList) return;

        footerList.innerHTML = '';
        const footerLinks = adminState.siteContent.footer?.links || [];

        footerLinks.forEach((link, index) => {
            const linkItem = createFooterLinkElement(link, index);
            footerList.appendChild(linkItem);
        });
    }

    function createFooterLinkElement(link, index) {
        const div = document.createElement('div');
        div.className = 'footer-link-admin';
        div.innerHTML = `
            <input type="text" class="footer-link-text" value="${link.text}" data-index="${index}" placeholder="Link Text">
            <input type="text" class="footer-link-href" value="${link.href}" data-index="${index}" placeholder="#section">
            <button type="button" class="btn-remove" onclick="removeFooterLink(${index})">Remove</button>
        `;
        return div;
    }

    function populateSponsorshipTiers() {
        const tiersList = document.getElementById('sponsorshipTiersList');
        if (!tiersList) return;

        const tiers = adminState.siteContent.sponsorshipTiers || getDefaultSponsorshipTiers();
        tiersList.innerHTML = '';

        tiers.forEach((tier, index) => {
            const tierElement = createSponsorshipTierElement(tier, index);
            tiersList.appendChild(tierElement);
        });
    }

    function getDefaultSponsorshipTiers() {
        return [
            {
                name: 'Platinum',
                price: 'GHS 150,000+',
                benefits: [
                    'Title sponsor recognition',
                    'Logo placement on all materials',
                    'Speaking opportunity at grand finale',
                    '5 VIP tickets',
                    'Full-page advert in program',
                    'Brand mention in all media',
                    'Product activation booth',
                    'International livestream inclusion',
                    'Use winner for advertisement (1 year)'
                ]
            },
            {
                name: 'Gold',
                price: 'GHS 100,000',
                benefits: [
                    'Prominent logo placement',
                    '3 VIP tickets',
                    'Half-page advert',
                    'Brand mention in select media',
                    'Inclusion in training materials',
                    'Product display opportunity'
                ]
            },
            {
                name: 'Silver',
                price: 'GHS 50,000',
                benefits: [
                    'Logo on event banners',
                    '2 VIP tickets',
                    'Quarter-page advert',
                    'Social media recognition',
                    'Branded gifts opportunity'
                ]
            },
            {
                name: 'Bronze',
                price: 'GHS 25,000',
                benefits: [
                    'Logo listing on materials',
                    '1 VIP ticket',
                    'Acknowledgment during event',
                    'Flyers in contestant bags'
                ]
            }
        ];
    }

    function createSponsorshipTierElement(tier, index) {
        const div = document.createElement('div');
        div.className = 'sponsorship-tier-admin';
        div.innerHTML = `
            <h4>${tier.name} Sponsor</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Tier Name</label>
                    <input type="text" class="tier-name" value="${tier.name}" data-index="${index}">
                </div>
                <div class="form-group">
                    <label>Price</label>
                    <input type="text" class="tier-price" value="${tier.price}" data-index="${index}">
                </div>
            </div>
            <div class="form-group">
                <label>Benefits</label>
                <div class="benefits-list" data-index="${index}">
                    ${tier.benefits.map((benefit, bIndex) => `
                        <div class="benefit-item">
                            <input type="text" class="benefit-text" value="${benefit}" data-tier="${index}" data-benefit="${bIndex}">
                            <button type="button" class="btn-remove" onclick="removeBenefit(${index}, ${bIndex})">Remove</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-add" onclick="addBenefit(${index})">+ Add Benefit</button>
            </div>
        `;
        return div;
    }

    function populateContestants() {
        const contestantsList = document.getElementById('contestantsAdminList');
        if (!contestantsList) return;

        // Load contestants from saved admin data first
        const savedContestants = localStorage.getItem('mdgh_contestants');
        if (savedContestants) {
            try {
                adminState.contestants = JSON.parse(savedContestants);
            } catch (e) {
                console.error('Error loading saved contestants:', e);
            }
        }
        
        // If no saved contestants, try to load from main site's script.js
        if (adminState.contestants.length === 0) {
            // Try to access contestantsData from main site
            // This would require script.js to be loaded, which we can't do here
            // Instead, we'll use default empty array and let user add contestants
            adminState.contestants = [];
        }

        contestantsList.innerHTML = '';
        
        if (adminState.contestants.length === 0) {
            contestantsList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No contestants added yet. Click "Add New Contestant" to get started.</p>';
        } else {
            adminState.contestants.forEach((contestant, index) => {
                const card = createContestantCardAdmin(contestant, index);
                contestantsList.appendChild(card);
            });
        }
    }

    function createContestantCardAdmin(contestant, index) {
        const div = document.createElement('div');
        div.className = 'contestant-card-admin';
        div.innerHTML = `
            <h4>${contestant.name}</h4>
            <p><strong>Location:</strong> ${contestant.location}</p>
            <p><strong>Cause:</strong> ${contestant.cause}</p>
            <p><strong>Category:</strong> ${contestant.category}</p>
            <div class="contestant-actions">
                <button type="button" class="btn-edit" onclick="editContestant(${index})">Edit</button>
                <button type="button" class="btn-remove" onclick="removeContestant(${index})">Delete</button>
            </div>
        `;
        return div;
    }

    // Image Upload Handlers
    function setupImageUploads() {
        // Logo Upload
        const logoUpload = document.getElementById('mainLogoUpload');
        const logoPreview = document.getElementById('mainLogoPreview');
        if (logoUpload && logoPreview) {
            logoUpload.addEventListener('change', (e) => {
                handleImageUpload(e.target, logoPreview, 'logo-main');
            });
            document.querySelector('[data-target="logo-main"]')?.closest('.image-upload')?.querySelector('.btn-upload')?.addEventListener('click', () => {
                logoUpload.click();
            });
        }

        // Favicon Upload
        const faviconUpload = document.getElementById('faviconUpload');
        const faviconPreview = document.getElementById('faviconPreview');
        if (faviconUpload && faviconPreview) {
            faviconUpload.addEventListener('change', (e) => {
                handleImageUpload(e.target, faviconPreview, 'favicon');
            });
            document.querySelector('[data-target="favicon"]')?.closest('.image-upload')?.querySelector('.btn-upload')?.addEventListener('click', () => {
                faviconUpload.click();
            });
        }

        // About Image Upload
        const aboutImageUpload = document.getElementById('aboutImageUpload');
        if (aboutImageUpload) {
            aboutImageUpload.addEventListener('change', (e) => {
                handleImageUpload(e.target, null, 'about-image');
            });
        }
    }

    function handleImageUpload(input, preview, target) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (preview) {
                    preview.src = e.target.result;
                }
                // Store filename
                adminState.siteContent[target] = file.name;
                showSaveStatus('Image preview updated. Click "Save All Changes" to apply.', 'success');
            };
            reader.readAsDataURL(file);
        }
    }

    // Auto-save Setup
    function setupAutoSave() {
        // General Settings
        document.querySelectorAll('[data-target]').forEach(input => {
            input.addEventListener('input', () => {
                const target = input.dataset.target;
                const value = input.type === 'color' ? input.value : input.value;
                updateContent(target, value);
            });
        });

        // Navigation items
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('nav-text') || e.target.classList.contains('nav-href')) {
                const index = parseInt(e.target.dataset.index);
                updateNavigationItem(index, e.target.classList.contains('nav-text') ? 'text' : 'href', e.target.value);
            }
        });

        // Footer links
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('footer-link-text') || e.target.classList.contains('footer-link-href')) {
                const index = parseInt(e.target.dataset.index);
                updateFooterLink(index, e.target.classList.contains('footer-link-text') ? 'text' : 'href', e.target.value);
            }
        });
    }

    function updateContent(target, value) {
        const keys = target.split('-');
        let obj = adminState.siteContent;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) {
                obj[keys[i]] = {};
            }
            obj = obj[keys[i]];
        }
        
        obj[keys[keys.length - 1]] = value;
    }

    function updateNavigationItem(index, field, value) {
        if (!adminState.siteContent.navigation) {
            adminState.siteContent.navigation = [];
        }
        if (!adminState.siteContent.navigation[index]) {
            adminState.siteContent.navigation[index] = {};
        }
        adminState.siteContent.navigation[index][field] = value;
    }

    function updateFooterLink(index, field, value) {
        if (!adminState.siteContent.footer) {
            adminState.siteContent.footer = {};
        }
        if (!adminState.siteContent.footer.links) {
            adminState.siteContent.footer.links = [];
        }
        if (!adminState.siteContent.footer.links[index]) {
            adminState.siteContent.footer.links[index] = {};
        }
        adminState.siteContent.footer.links[index][field] = value;
    }

    // Save All Changes
    function saveAllChanges() {
        const saveBtn = document.getElementById('saveAllBtn');
        if (!saveBtn) return;

        // Prevent multiple clicks
        if (saveBtn.classList.contains('saving')) {
            return;
        }

        // Set loading state
        saveBtn.classList.add('saving');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            // Collect all form data
            collectFormData();

            // Save to localStorage
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(adminState.siteContent));

            // Save contestants separately
            if (adminState.contestants.length > 0) {
                localStorage.setItem('mdgh_contestants', JSON.stringify(adminState.contestants));
            }

            // Apply changes to main site
            applyChangesToSite();

            // Show success message
            showSaveStatus('All changes saved successfully!', 'success');

            // Reset button state after a short delay
            setTimeout(() => {
                saveBtn.classList.remove('saving');
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 1500);

        } catch (error) {
            console.error('Error saving changes:', error);
            showSaveStatus('Error saving changes. Please try again.', 'error');
            
            // Reset button state
            saveBtn.classList.remove('saving');
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }

    function collectFormData() {
        // Collect all form values
        document.querySelectorAll('[data-target]').forEach(input => {
            const target = input.dataset.target;
            const value = input.type === 'color' ? input.value : input.value;
            updateContent(target, value);
        });

        // Collect navigation
        const navItems = [];
        document.querySelectorAll('.nav-item-admin').forEach(item => {
            const text = item.querySelector('.nav-text').value;
            const href = item.querySelector('.nav-href').value;
            if (text && href) {
                navItems.push({ text, href });
            }
        });
        adminState.siteContent.navigation = navItems;

        // Collect footer
        const footerLinks = [];
        document.querySelectorAll('.footer-link-admin').forEach(item => {
            const text = item.querySelector('.footer-link-text').value;
            const href = item.querySelector('.footer-link-href').value;
            if (text && href) {
                footerLinks.push({ text, href });
            }
        });
        if (!adminState.siteContent.footer) {
            adminState.siteContent.footer = {};
        }
        adminState.siteContent.footer.links = footerLinks;

        // Collect sponsorship tiers
        const tiers = [];
        document.querySelectorAll('.sponsorship-tier-admin').forEach((tierEl, index) => {
            const name = tierEl.querySelector('.tier-name')?.value || '';
            const price = tierEl.querySelector('.tier-price')?.value || '';
            const benefits = [];
            
            tierEl.querySelectorAll('.benefit-text').forEach(benefitInput => {
                const benefitText = benefitInput.value.trim();
                if (benefitText) {
                    benefits.push(benefitText);
                }
            });

            if (name || price) {
                tiers.push({ name, price, benefits });
            }
        });
        adminState.siteContent.sponsorshipTiers = tiers;
    }

    function applyChangesToSite() {
        // This will be called when saving
        // In production, you'd send this to a backend API
        // For now, we'll store it and the main site can load it
        
        // Create a script tag that the main site can load
        const script = document.createElement('script');
        script.id = 'mdgh-admin-content';
        script.type = 'application/json';
        script.textContent = JSON.stringify(adminState.siteContent);
        
        // Store in localStorage for main site to load
        localStorage.setItem('mdgh_site_content', JSON.stringify(adminState.siteContent));
    }

    function showSaveStatus(message, type) {
        const status = document.getElementById('saveStatus');
        status.className = `save-status ${type} show`;
        status.textContent = message;
        
        setTimeout(() => {
            status.classList.remove('show');
        }, 3000);
    }

    // Contestant Management
    function setupContestantManagement() {
        document.getElementById('addContestantBtn')?.addEventListener('click', () => {
            openContestantModal();
        });

        document.getElementById('closeContestantModal')?.addEventListener('click', () => {
            closeContestantModal();
        });

        document.getElementById('cancelContestantBtn')?.addEventListener('click', () => {
            closeContestantModal();
        });

        document.getElementById('contestantAdminForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            saveContestant();
        });
    }

    let editingContestantIndex = null;

    function openContestantModal(contestantIndex = null) {
        const modal = document.getElementById('contestantAdminModal');
        const form = document.getElementById('contestantAdminForm');
        
        if (contestantIndex !== null) {
            editingContestantIndex = contestantIndex;
            const contestant = adminState.contestants[contestantIndex];
            document.getElementById('modalTitle').textContent = 'Edit Contestant';
            
            // Populate form
            document.getElementById('adminContestantName').value = contestant.name || '';
            document.getElementById('adminContestantLocation').value = contestant.location || '';
            document.getElementById('adminContestantCause').value = contestant.cause || '';
            document.getElementById('adminContestantCategory').value = contestant.category || 'contestant';
            document.getElementById('adminContestantEducation').value = contestant.education || '';
            document.getElementById('adminContestantProfession').value = contestant.profession || '';
            document.getElementById('adminContestantBio').value = contestant.bio || '';
            document.getElementById('adminContestantAchievements').value = contestant.achievements?.join('\n') || '';
            document.getElementById('adminContestantProjects').value = contestant.stats?.projects || 0;
            document.getElementById('adminContestantImpact').value = contestant.stats?.impact || '';
            document.getElementById('adminContestantImageText').value = contestant.image || '';
            document.getElementById('adminContestantInstagram').value = contestant.social?.instagram || '';
            document.getElementById('adminContestantTwitter').value = contestant.social?.twitter || '';
            document.getElementById('adminContestantLinkedIn').value = contestant.social?.linkedin || '';
        } else {
            editingContestantIndex = null;
            document.getElementById('modalTitle').textContent = 'Add New Contestant';
            form.reset();
        }
        
        modal.classList.add('active');
    }

    function closeContestantModal() {
        document.getElementById('contestantAdminModal').classList.remove('active');
        editingContestantIndex = null;
    }

    function saveContestant() {
        const form = document.getElementById('contestantAdminForm');
        const formData = {
            name: document.getElementById('adminContestantName').value,
            location: document.getElementById('adminContestantLocation').value,
            cause: document.getElementById('adminContestantCause').value,
            category: document.getElementById('adminContestantCategory').value,
            education: document.getElementById('adminContestantEducation').value,
            profession: document.getElementById('adminContestantProfession').value,
            bio: document.getElementById('adminContestantBio').value,
            achievements: document.getElementById('adminContestantAchievements').value.split('\n').filter(a => a.trim()),
            stats: {
                projects: parseInt(document.getElementById('adminContestantProjects').value) || 0,
                impact: document.getElementById('adminContestantImpact').value || '0'
            },
            image: document.getElementById('adminContestantImageText').value || 'a-photo-of-a-confident-elegant-ghanaian.jpeg',
            social: {
                instagram: document.getElementById('adminContestantInstagram').value || '',
                twitter: document.getElementById('adminContestantTwitter').value || '',
                linkedin: document.getElementById('adminContestantLinkedIn').value || ''
            }
        };

        // Handle image upload
        const imageFile = document.getElementById('adminContestantImage').files[0];
        if (imageFile) {
            formData.image = imageFile.name;
        }

        if (editingContestantIndex !== null) {
            adminState.contestants[editingContestantIndex] = formData;
        } else {
            formData.id = adminState.contestants.length + 1;
            adminState.contestants.push(formData);
        }

        populateContestants();
        closeContestantModal();
        showSaveStatus('Contestant saved! Click "Save All Changes" to apply.', 'success');
    }

    // Global functions for onclick handlers
    window.removeNavItem = function(index) {
        if (confirm('Remove this navigation item?')) {
            adminState.siteContent.navigation.splice(index, 1);
            populateNavigation();
        }
    };

    window.removeFooterLink = function(index) {
        if (confirm('Remove this footer link?')) {
            adminState.siteContent.footer.links.splice(index, 1);
            populateFooter();
        }
    };

    window.addBenefit = function(tierIndex) {
        const benefitsList = document.querySelector(`[data-index="${tierIndex}"].benefits-list`);
        if (!benefitsList) return;

        const benefitIndex = benefitsList.children.length;
        const div = document.createElement('div');
        div.className = 'benefit-item';
        div.innerHTML = `
            <input type="text" class="benefit-text" value="" data-tier="${tierIndex}" data-benefit="${benefitIndex}" placeholder="Enter benefit">
            <button type="button" class="btn-remove" onclick="removeBenefit(${tierIndex}, ${benefitIndex})">Remove</button>
        `;
        benefitsList.appendChild(div);
    };

    window.removeBenefit = function(tierIndex, benefitIndex) {
        const benefitsList = document.querySelector(`[data-index="${tierIndex}"].benefits-list`);
        if (benefitsList && benefitsList.children[benefitIndex]) {
            benefitsList.children[benefitIndex].remove();
        }
    };

    window.editContestant = function(index) {
        openContestantModal(index);
    };

    window.removeContestant = function(index) {
        if (confirm('Are you sure you want to delete this contestant?')) {
            adminState.contestants.splice(index, 1);
            populateContestants();
            showSaveStatus('Contestant removed. Click "Save All Changes" to apply.', 'success');
        }
    };


    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

