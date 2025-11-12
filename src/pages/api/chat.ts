import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { message } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get API key from Cloudflare environment
    // @ts-ignore - Cloudflare runtime env
    const apiKey = locals.runtime?.env?.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured. Please add GEMINI_API_KEY to Cloudflare environment variables.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Context about MDGH
    const context = `You are an AI assistant for Miss Diaspora Ghana (MDGH), a prestigious pageant celebrating women of African descent.

IMPORTANT INFORMATION:
- Organization: Nubian Crown Company Limited
- General Manager: Yvonne Kofigah
- Contact: info@missdiasporagh.org | +233 591942227 | +233 256123084
- Website: www.missdiasporagh.org

ABOUT MDGH:
Miss Diaspora Ghana celebrates the beauty and strength of women of African descent. Our mission empowers young leaders to connect with their roots and make a difference through leadership training, cultural identity, and social impact programs.

OBJECTIVES:
1. Promote Cultural Identity - Celebrate Ghanaian heritage
2. Empower Young Women - Showcase talents and leadership
3. Strengthen Diaspora Engagement - Connect communities
4. Promote Tourism & Investment - Position Ghana globally
5. Support Social Impact - Champion education, health, youth development
6. Create Brand Opportunities - Visibility for sponsors

PROGRAMS:
- Mentorship Program
- Cultural Workshops
- Community Outreach
- Cultural Immersion Week (for finalists)
- Grand Finale Event (televised)
- Post-Event Ambassadorship (1-year reign)

ELIGIBILITY:
- Women of African descent
- Ages 18-30
- Passion for leadership and cultural empowerment
- A cause you champion
- Willing to serve as ambassador for 1 year if crowned

PARTNERSHIP LEVELS:
- Platinum (Elite Partner - Title Sponsor Level): Exclusive title sponsor status, maximum brand visibility, premium speaking opportunities
- Gold (Premier Partner - Major Supporter Level): Prominent brand positioning, VIP event access, strategic media presence
- Silver (Valued Partner - Core Supporter Level): Brand recognition across events, VIP guest privileges, marketing collateral inclusion
- Bronze (Supporting Partner - Foundation Level): Official partner recognition, event participation access, brand acknowledgment

We welcome strategic partnerships and can customize packages. Encourage inquiries to discuss collaboration opportunities.

PRIZES:
- 1-year ambassadorial role
- Scholarship opportunities
- International exposure
- Platform to champion causes
- Professional development

Always be friendly, informative, and encouraging. If asked about applying, direct them to contact us or fill out the form. If unsure about specific dates or details, advise them to contact us directly.`;

    // Initialize Google Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Combine context and user message
    const prompt = `${context}\n\nUser: ${message}\n\nAssistant:`;

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return new Response(JSON.stringify({ response: text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('AI API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to get response from AI',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
