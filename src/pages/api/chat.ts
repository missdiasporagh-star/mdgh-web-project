import type { APIRoute } from 'astro';

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
    const apiKey = locals.runtime?.env?.OPENROUTER_API_KEY || import.meta.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
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

    // Call OpenRouter API
    // Using Qwen 2.5 7B - free and reliable
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mdgh-web-project.pages.dev',
        'X-Title': 'MDGH Chatbot'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free', // Meta Llama - widely available free model
        messages: [
          {
            role: 'system',
            content: context
          },
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`);
      }
      const errorMsg = errorData.error?.message || errorData.message || JSON.stringify(errorData);
      throw new Error(`OpenRouter: ${errorMsg}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid response from OpenRouter API');
    }

    const text = data.choices[0].message.content;

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
