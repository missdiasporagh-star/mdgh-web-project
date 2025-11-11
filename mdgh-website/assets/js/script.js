// Load Admin Content (if available)
function loadAdminContent() {
    const savedContent = localStorage.getItem('mdgh_site_content');
    if (!savedContent) return;

    try {
        const content = JSON.parse(savedContent);

        // Update Site Title & Meta
        if (content.siteTitle) {
            document.title = content.siteTitle;
        }
        if (content.metaDescription) {
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.content = content.metaDescription;
        }

        // Update Favicon
        if (content.favicon) {
            let favicon = document.querySelector('link[rel="icon"]');
            if (!favicon) {
                favicon = document.createElement('link');
                favicon.rel = 'icon';
                document.head.appendChild(favicon);
            }
            favicon.href = content.favicon;
        }

        // Update Logo
        if (content.logo) {
            const logos = document.querySelectorAll('.logo-image');
            logos.forEach(logo => {
                logo.src = content.logo;
            });
        }

        // Update Colors
        if (content.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', content.primaryColor);
        }
        if (content.secondaryColor) {
            document.documentElement.style.setProperty('--secondary-color', content.secondaryColor);
        }

        // Update Hero Section
        if (content.hero) {
            const heroTitle = document.querySelector('.hero-title');
            if (heroTitle && content.hero.title1) {
                const lines = heroTitle.querySelectorAll('.title-line');
                if (lines[0]) lines[0].textContent = content.hero.title1;
                if (lines[1]) lines[1].textContent = content.hero.title2;
                if (lines[2]) lines[2].textContent = content.hero.title3;
            }
            const heroSubtitle = document.querySelector('.hero-subtitle');
            if (heroSubtitle && content.hero.subtitle) {
                heroSubtitle.textContent = content.hero.subtitle;
            }
            const heroBtn1 = document.querySelector('.hero-buttons .btn-primary');
            if (heroBtn1 && content.hero.btn1) {
                heroBtn1.textContent = content.hero.btn1;
            }
            const heroBtn2 = document.querySelector('.hero-buttons .btn-secondary');
            if (heroBtn2 && content.hero.btn2) {
                heroBtn2.textContent = content.hero.btn2;
            }
            if (content.hero.video) {
                const video = document.querySelector('.hero-video source');
                if (video) video.src = content.hero.video;
                const videoEl = document.querySelector('.hero-video');
                if (videoEl) videoEl.load();
            }
        }

        // Update Navigation
        if (content.navigation && Array.isArray(content.navigation)) {
            const navMenu = document.querySelector('.nav-menu');
            if (navMenu) {
                const navLinks = navMenu.querySelectorAll('.nav-link:not(.btn-apply)');
                const mobileMenuBg = navMenu.querySelector('.mobile-menu-bg');
                const applyBtn = navMenu.querySelector('.btn-apply');
                
                navLinks.forEach((link, index) => {
                    if (content.navigation[index]) {
                        link.textContent = content.navigation[index].text;
                        link.href = content.navigation[index].href;
                    }
                });
                
                // Reconstruct navigation if needed
                if (content.navigation.length > navLinks.length) {
                    navLinks.forEach(link => link.remove());
                    content.navigation.forEach((item, index) => {
                        if (index < content.navigation.length - 1) { // Don't replace Apply button
                            const li = document.createElement('li');
                            const a = document.createElement('a');
                            a.href = item.href;
                            a.className = 'nav-link';
                            a.textContent = item.text;
                            li.appendChild(a);
                            if (applyBtn && applyBtn.parentElement) {
                                navMenu.insertBefore(li, applyBtn.parentElement);
                            } else {
                                navMenu.insertBefore(li, mobileMenuBg);
                            }
                        }
                    });
                }
            }
        }

        // Update About Section
        if (content.about) {
            const aboutTitle = document.querySelector('#about h2');
            if (aboutTitle && content.about.title) {
                aboutTitle.textContent = content.about.title;
            }
            const aboutDesc = document.querySelectorAll('.about-text p');
            if (aboutDesc[0] && content.about.desc1) {
                aboutDesc[0].textContent = content.about.desc1;
            }
            if (aboutDesc[1] && content.about.desc2) {
                aboutDesc[1].textContent = content.about.desc2;
            }
            if (content.about.image) {
                const aboutImg = document.querySelector('.about-image img');
                if (aboutImg) aboutImg.src = content.about.image;
            }
        }

        // Update Footer
        if (content.footer) {
            const footerText = document.querySelector('.footer-text');
            if (footerText) {
                let footerHTML = '';
                if (content.footer.copyright) {
                    footerHTML += content.footer.copyright;
                }
                if (content.footer.organization) {
                    if (footerHTML) footerHTML += '<br>';
                    footerHTML += content.footer.organization;
                }
                if (footerHTML) {
                    footerText.innerHTML = footerHTML;
                }
            }
            if (content.footer.links && Array.isArray(content.footer.links)) {
                const footerLinksContainer = document.querySelector('.footer-links');
                if (footerLinksContainer) {
                    footerLinksContainer.innerHTML = '';
                    content.footer.links.forEach(link => {
                        const a = document.createElement('a');
                        a.href = link.href;
                        a.textContent = link.text;
                        footerLinksContainer.appendChild(a);
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error loading admin content:', error);
    }
}

// Load contestants from admin
function loadAdminContestants() {
    const savedContestants = localStorage.getItem('mdgh_contestants');
    if (savedContestants) {
        try {
            const contestants = JSON.parse(savedContestants);
            if (Array.isArray(contestants) && contestants.length > 0) {
                // Store in a way that can override default contestantsData
                window.adminContestantsLoaded = true;
                window.adminContestants = contestants;
            }
        } catch (error) {
            console.error('Error loading admin contestants:', error);
        }
    }
}

// Get contestants data (admin or default)
function getContestantsData() {
    if (window.adminContestantsLoaded && window.adminContestants) {
        return window.adminContestants;
    }
    return contestantsData;
}

// Load admin content when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadAdminContent();
        loadAdminContestants();
    });
} else {
    loadAdminContent();
    loadAdminContestants();
}

// Navigation Scroll Effect
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth Scrolling for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Scroll Reveal Animation
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, observerOptions);

// Observe all sections and cards
document.querySelectorAll('section, .pillar-card, .objective-card, .program-card, .tier-card, .why-item').forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
});

// Animated Counter for Statistics
const animateCounter = (element, target, suffix = '') => {
    let current = 0;
    const increment = target / 100;
    const duration = 2000; // 2 seconds
    const stepTime = duration / 100;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            if (target < 10) {
                element.textContent = current.toFixed(1);
            } else {
                element.textContent = Math.floor(current);
            }
        }
    }, stepTime);
};

// Observe statistics section
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumbers = entry.target.querySelectorAll('.stat-number');
            statNumbers.forEach((stat) => {
                const target = parseFloat(stat.getAttribute('data-target'));
                // The suffix is handled separately in the HTML structure
                animateCounter(stat, target);
            });
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.stats');
if (statsSection) {
    statsObserver.observe(statsSection);
}

// Contact Form Handling with EmailJS
(function() {
    // Initialize EmailJS
    emailjs.init("HipXYBBNK8hTfKEO1"); // MDGH EmailJS Public Key
    
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnLoader = document.getElementById('btnLoader');
    const formMessage = document.getElementById('formMessage');
    const charCount = document.getElementById('charCount');
    const messageTextarea = document.getElementById('message');
    
    // Character counter for message textarea
    if (messageTextarea && charCount) {
        messageTextarea.addEventListener('input', () => {
            const count = messageTextarea.value.length;
            charCount.textContent = count;
            
            if (count > 1000) {
                charCount.style.color = '#e74c3c';
                messageTextarea.setCustomValidity('Message must be 1000 characters or less');
            } else {
                charCount.style.color = '';
                messageTextarea.setCustomValidity('');
            }
        });
    }
    
    // Real-time validation
    const validateField = (field, errorElement) => {
        const fieldGroup = field.closest('.form-group');
        
        if (!field.validity.valid) {
            fieldGroup.classList.add('error');
            if (field.validity.valueMissing) {
                errorElement.textContent = 'This field is required';
            } else if (field.validity.typeMismatch) {
                errorElement.textContent = 'Please enter a valid ' + field.type;
            } else {
                errorElement.textContent = field.validationMessage;
            }
            return false;
        } else {
            fieldGroup.classList.remove('error');
            errorElement.textContent = '';
            return true;
        }
    };
    
    // Add validation listeners
    const formFields = [
        { id: 'name', errorId: 'nameError' },
        { id: 'email', errorId: 'emailError' },
        { id: 'phone', errorId: 'phoneError' },
        { id: 'subject', errorId: 'subjectError' },
        { id: 'message', errorId: 'messageError' },
        { id: 'consent', errorId: 'consentError' }
    ];
    
    formFields.forEach(({ id, errorId }) => {
        const field = document.getElementById(id);
        const errorElement = document.getElementById(errorId);
        
        if (field && errorElement) {
            field.addEventListener('blur', () => {
                validateField(field, errorElement);
            });
            
            field.addEventListener('input', () => {
                if (field.classList.contains('error')) {
                    validateField(field, errorElement);
                }
            });
        }
    });
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Hide previous messages
            formMessage.className = 'form-message';
            formMessage.textContent = '';
            
            // Validate all fields
            let isValid = true;
            formFields.forEach(({ id, errorId }) => {
                const field = document.getElementById(id);
                const errorElement = document.getElementById(errorId);
                if (field && errorElement) {
                    if (!validateField(field, errorElement)) {
                        isValid = false;
                    }
                }
            });
            
            if (!isValid) {
                formMessage.className = 'form-message error';
                formMessage.textContent = 'Please correct the errors above before submitting.';
                formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }
            
            // Show loading state
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            
            // Get form data
            const formData = {
                from_name: document.getElementById('name').value,
                from_email: document.getElementById('email').value,
                phone: document.getElementById('phone').value || 'Not provided',
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
                to_email: 'info@missdiasporagh.org'
            };
            
            try {
                // Send email using EmailJS
                const response = await emailjs.send(
                    'service_tj0jwc5',      // MDGH EmailJS Service ID
                    'template_w9i6tzh',     // MDGH EmailJS Template ID
                    {
                        to_email: formData.to_email,
                        from_name: formData.from_name,
                        from_email: formData.from_email,
                        phone: formData.phone,
                        subject: formData.subject,
                        message: formData.message,
                        reply_to: formData.from_email
                    }
                );
                
                // Success
                formMessage.className = 'form-message success';
                formMessage.textContent = 'Thank you! Your message has been sent successfully. We will get back to you soon.';
                contactForm.reset();
                charCount.textContent = '0';
                
                // Scroll to success message
                formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                
                // Reset form after 5 seconds
                setTimeout(() => {
                    formMessage.className = 'form-message';
                }, 5000);
                
            } catch (error) {
                console.error('EmailJS Error:', error);
                formMessage.className = 'form-message error';
                formMessage.textContent = 'Sorry, there was an error sending your message. Please try again or contact us directly at info@missdiasporagh.org';
                formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } finally {
                // Remove loading state
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        });
    }
})();

// Parallax Effect for Hero Section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero && scrolled < window.innerHeight) {
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// Video Playback Control
const heroVideo = document.querySelector('.hero-video');
if (heroVideo) {
    // Ensure video plays on mobile
    heroVideo.addEventListener('loadedmetadata', () => {
        heroVideo.play().catch(error => {
            console.log('Video autoplay prevented:', error);
        });
    });
}

// Add active class to current section in navigation
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 150) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Lazy Loading for Images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            }
        });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Add loading state to buttons
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        if (this.type === 'submit') {
            // Add loading state for form submissions
            this.style.opacity = '0.7';
            this.style.pointerEvents = 'none';
        }
    });
});

// Console Welcome Message
console.log('%cMiss Diaspora Ghana', 'font-size: 24px; font-weight: bold; color: #F8B92F;');
console.log('%cEmpowering women of African descent to lead, serve, and connect Ghana with its global diaspora.', 'font-size: 14px; color: #666;');

// ========================================
// ENHANCED FEATURES & ANIMATIONS
// ========================================

// Page Loader
window.addEventListener('load', () => {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('hidden');
            // Remove from DOM after transition
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }, 1500);
    }
});

// Enhanced Scroll Animations with IntersectionObserver
const enhancedObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Add animation classes based on data attributes
            const animationType = entry.target.dataset.animation || 'fade-in';
            entry.target.classList.add(animationType);

            // For staggered animations on children
            if (entry.target.dataset.stagger) {
                const children = entry.target.children;
                Array.from(children).forEach((child, index) => {
                    setTimeout(() => {
                        child.style.opacity = '1';
                        child.style.transform = 'translateY(0)';
                    }, index * 100);
                });
            }
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

// Observe elements for animations
document.addEventListener('DOMContentLoaded', () => {
    // Add animation attributes to sections
    document.querySelectorAll('.pillar-card').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease-out';
        el.dataset.animation = 'scale-in';
        enhancedObserver.observe(el);
    });

    document.querySelectorAll('.objective-card').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease-out';
        el.dataset.animation = 'bounce-in';
        enhancedObserver.observe(el);
    });

    document.querySelectorAll('.program-card').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50px)';
        el.style.transition = 'all 0.6s ease-out';
        el.dataset.animation = 'slide-in-left';
        enhancedObserver.observe(el);
    });

    document.querySelectorAll('.tier-card').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.8)';
        el.style.transition = 'all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        el.dataset.animation = 'flip-in';
        setTimeout(() => {
            enhancedObserver.observe(el);
        }, index * 200);
    });
});

// Parallax Effect for Multiple Elements
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;

    // Hero parallax (already exists, keep it)
    const hero = document.querySelector('.hero');
    if (hero && scrolled < window.innerHeight) {
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }

    // About section parallax
    const aboutImage = document.querySelector('.about-image');
    if (aboutImage) {
        const rect = aboutImage.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            const offset = (window.innerHeight - rect.top) * 0.1;
            aboutImage.style.transform = `translateY(${offset}px)`;
        }
    }
});

// ========================================
// CHATBOT FUNCTIONALITY
// ========================================

const chatbotKnowledgeBase = {
    'about': {
        keywords: ['about', 'pageant', 'what is', 'tell me', 'mdgh', 'miss diaspora'],
        response: 'Miss Diaspora Ghana (MDGH) is dedicated to celebrating the beauty and strength of women of African descent. Our mission empowers young leaders to connect with their roots and make a difference through leadership training, cultural identity, and social impact programs.'
    },
    'apply': {
        keywords: ['apply', 'application', 'how to', 'register', 'sign up', 'join', 'participate'],
        response: 'To apply for Miss Diaspora Ghana, scroll to the "Contact" section and fill out the form with your details. Select "Pageant Application" as the subject. You can also reach us at info@missdiasporagh.org or call +233 591942227.'
    },
    'requirements': {
        keywords: ['requirements', 'eligible', 'eligibility', 'qualify', 'criteria'],
        response: 'Applicants must be women of African descent, aged 18-30, with a passion for leadership and cultural empowerment. You should have a cause you\'re passionate about and be willing to serve as an ambassador for one year if crowned.'
    },
    'sponsorship': {
        keywords: ['sponsor', 'sponsorship', 'partner', 'partnership', 'tiers', 'benefits'],
        response: 'We offer 4 sponsorship tiers: Platinum (GHS 150,000+), Gold (GHS 100,000), Silver (GHS 50,000), and Bronze (GHS 25,000). Benefits include brand visibility, VIP tickets, media coverage, and more. Scroll to the Sponsorship section for full details!'
    },
    'contact': {
        keywords: ['contact', 'reach', 'email', 'phone', 'call', 'message', 'location'],
        response: 'You can reach us at:\n📧 info@missdiasporagh.org\n📞 +233 591942227 or +233 256123084\n👤 Yvonne Kofigah, General Manager\n🌐 www.missdiasporagh.org'
    },
    'programs': {
        keywords: ['programs', 'initiatives', 'activities', 'events', 'what do', 'immersion'],
        response: 'Our programs include: Mentorship Program, Cultural Workshops, Community Outreach, Cultural Immersion Week, Grand Finale Event, and Post-Event Ambassadorship. Each program is designed to empower and connect women with their heritage.'
    },
    'dates': {
        keywords: ['when', 'date', 'schedule', 'timeline', 'year'],
        response: 'The Miss Diaspora Ghana pageant runs annually. For specific dates for this year\'s event, please contact us directly or check our website for updates. The pageant typically includes a cultural immersion week followed by the grand finale.'
    },
    'prizes': {
        keywords: ['prize', 'win', 'reward', 'crown', 'winner', 'what do you get'],
        response: 'The crowned queen receives a 1-year ambassadorial role, scholarship opportunities, international exposure, and the chance to champion causes close to her heart. Additional prizes and benefits are announced closer to the event date.'
    },
    'contestants': {
        keywords: ['contestants', 'participants', 'competitors', 'queens', 'finalists'],
        response: 'Our contestants are inspiring women from across the diaspora - from the USA, UK, Canada, Australia, and beyond. Each brings unique talents, causes, and a passion for cultural empowerment. Check out the Contestants section to meet them!'
    }
};

class ChatBot {
    constructor() {
        this.isOpen = false;
        this.messagesContainer = document.getElementById('chatbotMessages');
        this.input = document.getElementById('chatbotInput');
        this.sendButton = document.getElementById('chatbotSend');
        this.toggleButton = document.getElementById('chatbotToggle');
        this.closeButton = document.getElementById('chatbotClose');
        this.window = document.getElementById('chatbotWindow');
        this.quickReplies = document.getElementById('quickReplies');

        this.init();
    }

    init() {
        // Toggle chatbot
        this.toggleButton.addEventListener('click', () => this.toggle());
        this.closeButton.addEventListener('click', () => this.close());

        // Send message
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Quick replies
        document.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.dataset.message;
                this.input.value = message;
                this.sendMessage();
            });
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.window.classList.add('active');
        this.isOpen = true;
        this.input.focus();
    }

    close() {
        this.window.classList.remove('active');
        this.isOpen = false;
    }

    sendMessage() {
        const message = this.input.value.trim();
        if (!message) return;

        // Add user message
        this.addMessage(message, 'user');
        this.input.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        // Get bot response
        setTimeout(() => {
            this.hideTypingIndicator();
            const response = this.getBotResponse(message);
            this.addMessage(response, 'bot');
        }, 1000 + Math.random() * 1000);
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${sender}`;

        const time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-avatar">${sender === 'bot' ? 'MG' : 'U'}</div>
            <div class="message-content">
                <div class="message-bubble">${text.replace(/\n/g, '<br>')}</div>
            </div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    getBotResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();

        // Check knowledge base
        for (const [key, value] of Object.entries(chatbotKnowledgeBase)) {
            if (value.keywords.some(keyword => lowerMessage.includes(keyword))) {
                return value.response;
            }
        }

        // Greeting responses
        if (lowerMessage.match(/\b(hi|hello|hey|greetings)\b/)) {
            return 'Hello! 👋 How can I help you learn more about Miss Diaspora Ghana today?';
        }

        // Thank you responses
        if (lowerMessage.match(/\b(thank|thanks|appreciate)\b/)) {
            return 'You\'re very welcome! Is there anything else you\'d like to know about Miss Diaspora Ghana?';
        }

        // Default response
        return 'I\'m here to help! You can ask me about:\n\n• The pageant and how it works\n• Application process and requirements\n• Sponsorship opportunities\n• Our programs and initiatives\n• Contact information\n\nWhat would you like to know?';
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chatbot-message bot typing-indicator-message';
        typingDiv.innerHTML = `
            <div class="message-avatar">MG</div>
            <div class="message-content">
                <div class="message-bubble typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        this.messagesContainer.appendChild(typingDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = this.messagesContainer.querySelector('.typing-indicator-message');
        if (indicator) {
            indicator.remove();
        }
    }
}

// Initialize chatbot
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});

// Smooth scroll with offset for fixed nav
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Contestant Gallery Functionality
const contestantsData = [
    {
        id: 1,
        name: "Ama Serwaa Mensah",
        location: "New York, USA",
        cause: "Education for Girls",
        category: "finalist",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "Master's in Public Policy, Harvard University",
        profession: "Policy Advisor",
        bio: "Ama is a passionate advocate for girls' education in rural Ghana. She has worked with NGOs to build schools and provide scholarships for over 500 girls. Her vision is to ensure every Ghanaian girl has access to quality education.",
        achievements: [
            "Founded Education for All Ghana Initiative",
            "Raised $250,000 for school construction",
            "Mentored 200+ young women",
            "Featured in Forbes 30 Under 30"
        ],
        social: {
            instagram: "https://instagram.com/amaserwaa",
            twitter: "https://twitter.com/amaserwaa",
            linkedin: "https://linkedin.com/in/amaserwaa"
        },
        stats: {
            projects: 12,
            impact: "500+"
        }
    },
    {
        id: 2,
        name: "Akosua Adoma Boateng",
        location: "London, UK",
        cause: "Women's Health",
        category: "finalist",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "MD, University of London",
        profession: "Medical Doctor",
        bio: "Dr. Akosua specializes in women's health and reproductive rights. She runs free health clinics in Accra and Kumasi, providing essential healthcare services to underserved communities.",
        achievements: [
            "Established 3 free health clinics",
            "Treated 2,000+ patients annually",
            "Advocate for maternal health rights",
            "Medical Mission volunteer in 5 countries"
        ],
        social: {
            instagram: "https://instagram.com/drakosua",
            twitter: "https://twitter.com/drakosua",
            linkedin: "https://linkedin.com/in/drakosua"
        },
        stats: {
            projects: 8,
            impact: "2K+"
        }
    },
    {
        id: 3,
        name: "Efua Asantewaa Owusu",
        location: "Atlanta, USA",
        cause: "Youth Development",
        category: "finalist",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "MBA, Georgia State University",
        profession: "Youth Development Specialist",
        bio: "Efua empowers young Ghanaians through entrepreneurship training and mentorship programs. She believes in creating opportunities for the next generation to thrive.",
        achievements: [
            "Launched Youth Entrepreneurship Program",
            "Mentored 300+ young entrepreneurs",
            "Created 50+ job opportunities",
            "Organized annual Youth Summit"
        ],
        social: {
            instagram: "https://instagram.com/efuaasantewaa",
            twitter: "https://twitter.com/efuaasantewaa",
            linkedin: "https://linkedin.com/in/efuaasantewaa"
        },
        stats: {
            projects: 15,
            impact: "300+"
        }
    },
    {
        id: 4,
        name: "Abena Nana Adjoa",
        location: "Toronto, Canada",
        cause: "Cultural Preservation",
        category: "semifinalist",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "BA in African Studies, University of Toronto",
        profession: "Cultural Curator",
        bio: "Abena is dedicated to preserving and promoting Ghanaian culture through art, music, and storytelling. She organizes cultural festivals and workshops connecting the diaspora with their roots.",
        achievements: [
            "Founded Cultural Heritage Foundation",
            "Organized 10+ cultural festivals",
            "Published 2 books on Ghanaian culture",
            "Documentary filmmaker"
        ],
        social: {
            instagram: "https://instagram.com/abenanana",
            twitter: "https://twitter.com/abenanana",
            linkedin: "https://linkedin.com/in/abenanana"
        },
        stats: {
            projects: 10,
            impact: "1K+"
        }
    },
    {
        id: 5,
        name: "Yaa Asantewaa Darko",
        location: "Accra, Ghana",
        cause: "Financial Literacy",
        category: "semifinalist",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "BSc in Economics, University of Ghana",
        profession: "Financial Advisor",
        bio: "Yaa teaches financial literacy to women entrepreneurs in Ghana. She helps them access microfinance and build sustainable businesses that support their families and communities.",
        achievements: [
            "Trained 500+ women entrepreneurs",
            "Facilitated $1M in micro-loans",
            "Published financial literacy guide",
            "Radio show host"
        ],
        social: {
            instagram: "https://instagram.com/yaaasantewaa",
            twitter: "https://twitter.com/yaaasantewaa",
            linkedin: "https://linkedin.com/in/yaaasantewaa"
        },
        stats: {
            projects: 7,
            impact: "500+"
        }
    },
    {
        id: 6,
        name: "Maame Esi Mensah",
        location: "Los Angeles, USA",
        cause: "Environmental Conservation",
        category: "contestant",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "MSc in Environmental Science, UCLA",
        profession: "Environmental Consultant",
        bio: "Maame leads initiatives to protect Ghana's natural resources and promote sustainable practices. She works with communities to implement eco-friendly solutions.",
        achievements: [
            "Launched Tree Planting Initiative",
            "Planted 10,000+ trees",
            "Environmental awareness campaigns",
            "Green business advisor"
        ],
        social: {
            instagram: "https://instagram.com/maameesi",
            twitter: "https://twitter.com/maameesi",
            linkedin: "https://linkedin.com/in/maameesi"
        },
        stats: {
            projects: 6,
            impact: "10K+"
        }
    },
    {
        id: 7,
        name: "Akua Serwaa Adjei",
        location: "Chicago, USA",
        cause: "Mental Health",
        category: "contestant",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "MSc in Psychology, Northwestern University",
        profession: "Clinical Psychologist",
        bio: "Akua advocates for mental health awareness in Ghanaian communities. She provides counseling services and works to destigmatize mental health issues.",
        achievements: [
            "Established mental health hotline",
            "Counselled 1,000+ individuals",
            "Mental health awareness workshops",
            "Published research papers"
        ],
        social: {
            instagram: "https://instagram.com/akuaserwaa",
            twitter: "https://twitter.com/akuaserwaa",
            linkedin: "https://linkedin.com/in/akuaserwaa"
        },
        stats: {
            projects: 9,
            impact: "1K+"
        }
    },
    {
        id: 8,
        name: "Nana Ama Kumi",
        location: "Manchester, UK",
        cause: "Entrepreneurship",
        category: "contestant",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "MBA, Manchester Business School",
        profession: "Tech Entrepreneur",
        bio: "Nana Ama founded a tech startup that connects Ghanaian artisans with global markets. She's passionate about empowering local businesses through technology.",
        achievements: [
            "Founded Tech4Ghana platform",
            "Connected 200+ artisans globally",
            "Raised $500K in seed funding",
            "Tech innovation award winner"
        ],
        social: {
            instagram: "https://instagram.com/nanaamakumi",
            twitter: "https://twitter.com/nanaamakumi",
            linkedin: "https://linkedin.com/in/nanaamakumi"
        },
        stats: {
            projects: 5,
            impact: "200+"
        }
    },
    {
        id: 9,
        name: "Adwoa Baah",
        location: "Sydney, Australia",
        cause: "Arts & Culture",
        category: "alumni",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "MFA in Fine Arts, University of Sydney",
        profession: "Visual Artist",
        bio: "Adwoa uses her art to tell stories of the Ghanaian diaspora. Her work has been exhibited internationally and promotes cultural dialogue.",
        achievements: [
            "International art exhibitions",
            "Mentored 50+ young artists",
            "Art therapy programs",
            "Cultural ambassador"
        ],
        social: {
            instagram: "https://instagram.com/adwoabaah",
            twitter: "https://twitter.com/adwoabaah",
            linkedin: "https://linkedin.com/in/adwoabaah"
        },
        stats: {
            projects: 12,
            impact: "50+"
        }
    },
    {
        id: 10,
        name: "Akosua Nyarko",
        location: "Washington D.C., USA",
        cause: "Legal Advocacy",
        category: "semifinalist",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "JD, Georgetown University",
        profession: "Human Rights Lawyer",
        bio: "Akosua provides legal aid to vulnerable communities in Ghana. She specializes in women's rights and child protection cases.",
        achievements: [
            "Represented 100+ cases pro bono",
            "Legal aid clinics organizer",
            "Women's rights advocate",
            "Published legal articles"
        ],
        social: {
            instagram: "https://instagram.com/akosuanyarko",
            twitter: "https://twitter.com/akosuanyarko",
            linkedin: "https://linkedin.com/in/akosuanyarko"
        },
        stats: {
            projects: 11,
            impact: "100+"
        }
    },
    {
        id: 11,
        name: "Esi Mensah",
        location: "Berlin, Germany",
        cause: "STEM Education",
        category: "contestant",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "PhD in Computer Science, Technical University of Berlin",
        profession: "Computer Science Professor",
        bio: "Esi promotes STEM education for girls in Ghana. She runs coding bootcamps and mentorship programs to bridge the gender gap in technology.",
        achievements: [
            "Established Girls Code Ghana",
            "Trained 400+ girls in coding",
            "STEM scholarship fund founder",
            "Tech conference speaker"
        ],
        social: {
            instagram: "https://instagram.com/esimensah",
            twitter: "https://twitter.com/esimensah",
            linkedin: "https://linkedin.com/in/esimensah"
        },
        stats: {
            projects: 8,
            impact: "400+"
        }
    },
    {
        id: 12,
        name: "Yaa Asantewaa Adu",
        location: "Kumasi, Ghana",
        cause: "Community Development",
        category: "finalist",
        image: "a-photo-of-a-confident-elegant-ghanaian.jpeg",
        education: "MSc in Community Development, KNUST",
        profession: "Community Development Officer",
        bio: "Yaa works directly with rural communities to implement sustainable development projects. She focuses on clean water, sanitation, and economic empowerment.",
        achievements: [
            "Implemented 20+ community projects",
            "Brought clean water to 5 villages",
            "Established community savings groups",
            "Local development award winner"
        ],
        social: {
            instagram: "https://instagram.com/yaaasantewaaadu",
            twitter: "https://twitter.com/yaaasantewaaadu",
            linkedin: "https://linkedin.com/in/yaaasantewaaadu"
        },
        stats: {
            projects: 20,
            impact: "5K+"
        }
    }
];

// Contestant Gallery Variables
let currentFilter = 'all';
let currentSearch = '';
let displayedCount = 9;
let filteredContestants = [];

// Initialize Gallery
function initContestantGallery() {
    const grid = document.getElementById('contestantsGrid');
    if (!grid) return;

    // Use admin contestants if available, otherwise use default
    filteredContestants = [...getContestantsData()];

    renderContestants();
    setupFilters();
    setupSearch();
    setupModal();
    setupLoadMore();
}

// Render Contestants
function renderContestants() {
    const grid = document.getElementById('contestantsGrid');
    const resultsCount = document.getElementById('resultsCount');
    const loadMoreContainer = document.querySelector('.load-more-container');
    
    if (!grid) return;

    // Get current contestants data
    const currentContestantsData = getContestantsData();

    // Filter contestants
    filteredContestants = currentContestantsData.filter(contestant => {
        const matchesFilter = currentFilter === 'all' || contestant.category === currentFilter;
        const matchesSearch = currentSearch === '' || 
            contestant.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
            contestant.location.toLowerCase().includes(currentSearch.toLowerCase()) ||
            contestant.cause.toLowerCase().includes(currentSearch.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Update results count
    if (resultsCount) {
        resultsCount.textContent = filteredContestants.length;
    }

    // Clear grid
    grid.innerHTML = '';

    // Display contestants (limited by displayedCount)
    const toDisplay = filteredContestants.slice(0, displayedCount);
    
    toDisplay.forEach((contestant, index) => {
        const card = createContestantCard(contestant, index);
        grid.appendChild(card);
    });

    // Show/hide load more button
    if (loadMoreContainer) {
        if (filteredContestants.length > displayedCount) {
            loadMoreContainer.classList.remove('hidden');
        } else {
            loadMoreContainer.classList.add('hidden');
        }
    }
}

// Create Contestant Card
function createContestantCard(contestant, index) {
    const card = document.createElement('div');
    card.className = 'contestant-card reveal';
    card.dataset.category = contestant.category;
    card.dataset.id = contestant.id;
    
    const badgeText = {
        'finalist': 'Finalist',
        'semifinalist': 'Semifinalist',
        'contestant': 'Contestant',
        'alumni': 'Alumni'
    };

    card.innerHTML = `
        <div class="contestant-image">
            <img src="${contestant.image}" alt="${contestant.name}" loading="lazy">
            <div class="contestant-badge ${contestant.category}">${badgeText[contestant.category]}</div>
        </div>
        <div class="contestant-info">
            <h3 class="contestant-name">${contestant.name}</h3>
            <p class="contestant-location">📍 ${contestant.location}</p>
            <span class="contestant-cause">${contestant.cause}</span>
            <p class="contestant-bio">${contestant.bio}</p>
            <div class="contestant-stats">
                <div class="stat-item-mini">
                    <div class="stat-value-mini">${contestant.stats.projects}</div>
                    <div class="stat-label-mini">Projects</div>
                </div>
                <div class="stat-item-mini">
                    <div class="stat-value-mini">${contestant.stats.impact}</div>
                    <div class="stat-label-mini">Impact</div>
                </div>
            </div>
        </div>
    `;

    // Add click event to open modal
    card.addEventListener('click', () => {
        openContestantModal(contestant);
    });

    // Trigger animation
    setTimeout(() => {
        card.classList.add('visible');
    }, index * 100);

    return card;
}

// Setup Filters
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            // Update current filter
            currentFilter = btn.dataset.filter;
            displayedCount = 9; // Reset displayed count
            renderContestants();
            // Scroll to gallery
            document.getElementById('contestants').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// Setup Search
function setupSearch() {
    const searchInput = document.getElementById('contestantSearch');
    
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearch = e.target.value;
                displayedCount = 9; // Reset displayed count
                renderContestants();
            }, 300);
        });
    }
}

// Setup Modal
function setupModal() {
    const modal = document.getElementById('contestantModal');
    const modalClose = document.getElementById('modalClose');
    const modalOverlay = modal?.querySelector('.modal-overlay');

    if (modalClose) {
        modalClose.addEventListener('click', closeContestantModal);
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeContestantModal);
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('active')) {
            closeContestantModal();
        }
    });
}

// Open Contestant Modal
function openContestantModal(contestant) {
    const modal = document.getElementById('contestantModal');
    if (!modal) return;

    // Populate modal with contestant data
    document.getElementById('modalImage').src = contestant.image;
    document.getElementById('modalImage').alt = contestant.name;
    document.getElementById('modalName').textContent = contestant.name;
    document.getElementById('modalTitle').textContent = `${contestant.category.charAt(0).toUpperCase() + contestant.category.slice(1)} • ${contestant.location}`;
    document.getElementById('modalLocation').textContent = contestant.location;
    document.getElementById('modalCause').textContent = contestant.cause;
    document.getElementById('modalEducation').textContent = contestant.education;
    document.getElementById('modalProfession').textContent = contestant.profession;
    document.getElementById('modalBio').textContent = contestant.bio;

    // Set badge
    const badge = document.getElementById('modalBadge');
    const badgeText = {
        'finalist': 'Finalist',
        'semifinalist': 'Semifinalist',
        'contestant': 'Contestant',
        'alumni': 'Alumni'
    };
    badge.textContent = badgeText[contestant.category];
    badge.className = `modal-badge ${contestant.category}`;

    // Set achievements
    const achievementsList = document.getElementById('modalAchievements');
    achievementsList.innerHTML = '';
    contestant.achievements.forEach(achievement => {
        const li = document.createElement('li');
        li.textContent = achievement;
        achievementsList.appendChild(li);
    });

    // Set social links
    document.getElementById('modalInstagram').href = contestant.social.instagram;
    document.getElementById('modalTwitter').href = contestant.social.twitter;
    document.getElementById('modalLinkedIn').href = contestant.social.linkedin;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Contestant Modal
function closeContestantModal() {
    const modal = document.getElementById('contestantModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Setup Load More
function setupLoadMore() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            displayedCount += 9;
            renderContestants();
            
            // Smooth scroll to last card
            setTimeout(() => {
                const cards = document.querySelectorAll('.contestant-card');
                if (cards.length > 0) {
                    cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 100);
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Load admin content first, then initialize gallery
        loadAdminContestants();
        initContestantGallery();
    });
} else {
    // Load admin content first, then initialize gallery
    loadAdminContestants();
    initContestantGallery();
}


