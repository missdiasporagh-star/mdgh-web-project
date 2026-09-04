const AGE_OPTIONS = ['Under 18', '18-25', '26-35', 'Over 35'];
const QUESTIONS = [
  { name: 'isWoman', text: 'Do you identify as a woman?' },
  { name: 'africanDescent', text: 'Are you of African or Ghanaian descent?' },
  { name: 'outsideGhana', text: 'Do you currently reside outside Ghana?' },
  { name: 'validPassport', text: 'Do you hold a valid passport for travel to Accra?' },
];

export function init({ turnstileSiteKey }) {
  const state = {
    ageBand: null, isWoman: null, africanDescent: null, outsideGhana: null,
    validPassport: null, consentMediaUse: null, consentMarketing: null,
    consentPolicy: false, consentRefund: false, email: '', phone: '', turnstileToken: null,
  };

  renderQuiz(state, validate);
  setupBinaryToggles(state, validate);
  setupCheckbox(state, validate);
  setupEmail(state, validate);
  setupPhone(state, validate);
  setupTurnstile(turnstileSiteKey, (token) => { state.turnstileToken = token; validate(); });
  setupSubmit(state);

  function validate() {
    const eligible =
      (state.ageBand === '18-25' || state.ageBand === '26-35') &&
      state.isWoman === true &&
      state.africanDescent === true &&
      state.outsideGhana === true &&
      state.validPassport === true;
    const allAnswered =
      state.ageBand !== null &&
      state.isWoman !== null && state.africanDescent !== null &&
      state.outsideGhana !== null && state.validPassport !== null &&
      state.consentPolicy && state.consentRefund && state.consentMediaUse !== null && state.consentMarketing !== null &&
      isValidEmail(state.email) && isValidPhone(state.phone) && !!state.turnstileToken;

    document.getElementById('submit-btn').disabled = !(eligible && allAnswered);

    const dq = document.getElementById('disqualified-card');
    if (dq) dq.remove();
    if (state.ageBand && (state.isWoman === false || state.africanDescent === false || state.outsideGhana === false || state.validPassport === false || state.ageBand === 'Under 18' || state.ageBand === 'Over 35')) {
      showDisqualified(state);
    }
  }
}

function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isValidPhone(s) {
  // E.164-ish: '+' followed by country code + digits. Strip spaces/hyphens
  // before checking. Must start with + then 1-9 then 6-14 more digits.
  const cleaned = (s || '').replace(/[\s\-()]/g, '');
  return /^\+[1-9][0-9]{6,14}$/.test(cleaned);
}

// Render a semantic radiogroup of buttons that supports arrow-key navigation,
// roving tabindex, and screen-reader-friendly state via aria-checked.
function buildRadioGroup({ legendText, options, onSelect }) {
  const group = document.createElement('div');
  group.setAttribute('role', 'radiogroup');
  const legendId = `rg-${Math.random().toString(36).slice(2, 8)}`;
  const legend = document.createElement('p');
  legend.id = legendId;
  legend.style.cssText = 'font-size:13px;margin:0 0 6px';
  legend.textContent = legendText;
  group.setAttribute('aria-labelledby', legendId);
  group.appendChild(legend);

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
  const btnEls = [];
  options.forEach(({ label, value }, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-ghost';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.tabIndex = idx === 0 ? 0 : -1; // roving tabindex
    b.style.flex = '1 0 0';
    b.textContent = label;
    b.addEventListener('click', () => selectIndex(idx));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectIndex((idx + 1) % btnEls.length, { focus: true });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        selectIndex((idx - 1 + btnEls.length) % btnEls.length, { focus: true });
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        selectIndex(idx);
      }
    });
    btnEls.push(b);
    buttons.appendChild(b);
  });
  group.appendChild(buttons);

  function selectIndex(i, opts) {
    btnEls.forEach((el, j) => {
      const isSelected = j === i;
      el.classList.toggle('selected', isSelected);
      el.setAttribute('aria-checked', String(isSelected));
      el.tabIndex = isSelected ? 0 : -1;
    });
    if (opts && opts.focus) btnEls[i].focus();
    onSelect(options[i].value);
  }

  return group;
}

function renderQuiz(state, validate) {
  const host = document.getElementById('eligibility-quiz');
  host.appendChild(buildRadioGroup({
    legendText: '1. What is your age at the start of this cycle?',
    options: AGE_OPTIONS.map(band => ({ label: band, value: band })),
    onSelect: (val) => { state.ageBand = val; validate(); },
  }));

  QUESTIONS.forEach((q, i) => {
    host.appendChild(buildRadioGroup({
      legendText: `${i + 2}. ${q.text}`,
      options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
      onSelect: (val) => { state[q.name] = val; validate(); },
    }));
  });
}

function setupBinaryToggles(state, validate) {
  // Existing binary-toggle markup is in the HTML — upgrade in place to
  // proper radiogroup semantics + keyboard nav.
  document.querySelectorAll('.binary-toggle').forEach(group => {
    const name = group.dataset.name;
    group.setAttribute('role', 'radiogroup');
    // Find the prompt <p> immediately preceding the group and label by it.
    const promptEl = group.previousElementSibling;
    if (promptEl && promptEl.tagName === 'P') {
      if (!promptEl.id) promptEl.id = `bt-prompt-${name}`;
      group.setAttribute('aria-labelledby', promptEl.id);
    }
    const btns = Array.from(group.querySelectorAll('button'));
    btns.forEach((b, idx) => {
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.tabIndex = idx === 0 ? 0 : -1;
      b.addEventListener('click', () => selectBinary(idx));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          selectBinary((idx + 1) % btns.length, { focus: true });
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          selectBinary((idx - 1 + btns.length) % btns.length, { focus: true });
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          selectBinary(idx);
        }
      });
    });
    function selectBinary(i, opts) {
      btns.forEach((el, j) => {
        const isSelected = j === i;
        el.classList.toggle('selected', isSelected);
        el.setAttribute('aria-checked', String(isSelected));
        el.tabIndex = isSelected ? 0 : -1;
      });
      if (opts && opts.focus) btns[i].focus();
      state[name] = btns[i].dataset.value === 'true';
      validate();
    }
  });
}

function setupCheckbox(state, validate) {
  const policy = document.querySelector('input[name="consentPolicy"]');
  policy.addEventListener('change', () => { state.consentPolicy = policy.checked; validate(); });
  const refund = document.querySelector('input[name="consentRefund"]');
  if (refund) refund.addEventListener('change', () => { state.consentRefund = refund.checked; validate(); });
}

function setupEmail(state, validate) {
  const input = document.querySelector('input[name="email"]');
  input.addEventListener('input', () => { state.email = input.value.trim(); validate(); });
}

function setupPhone(state, validate) {
  const country = document.getElementById('phone-country');
  const prefix = document.getElementById('phone-prefix');
  const input = document.querySelector('input[name="phone"]');
  if (!country || !prefix || !input) return;
  const hint = document.getElementById('phone-help');
  const defaultHint = hint ? hint.textContent : '';

  function recompute() {
    const isOther = country.value === 'other';
    prefix.style.display = isOther ? 'none' : '';
    prefix.textContent = `+${country.value}`;
    input.placeholder = isOther ? '+27 82 000 0000' : '202 555 0142';

    if (isOther) {
      // Free-form full international number; formatting characters ignored.
      state.phone = input.value.trim().replace(/[\s\-()]/g, '');
    } else {
      // Country code comes from the dropdown; only the national part is typed.
      const national = input.value.replace(/\D/g, '');
      state.phone = national ? `+${country.value}${national}` : '';
    }

    if (hint) {
      if (!state.phone) {
        hint.textContent = defaultHint;
        hint.style.color = '';
      } else if (isValidPhone(state.phone)) {
        hint.textContent = `Looks good — ${state.phone}`;
        hint.style.color = '#7BC67E';
      } else {
        hint.textContent = isOther
          ? 'Include the country code, e.g. +27 82 000 0000'
          : 'Keep typing — your number without the country code';
        hint.style.color = '#FFD166';
      }
    }
    validate();
  }

  country.addEventListener('change', recompute);
  input.addEventListener('input', recompute);
}

function setupTurnstile(siteKey, onToken) {
  const host = document.getElementById('turnstile-host');
  const interval = setInterval(() => {
    if (window.turnstile) {
      clearInterval(interval);
      window.turnstile.render(host, { sitekey: siteKey, callback: onToken });
    }
  }, 100);
}

function setupSubmit(state) {
  const form = document.getElementById('apply-form');
  const errEl = document.getElementById('form-err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    const honeypot = form.elements.honeypot.value;

    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: state.email, phone: state.phone, ageBand: state.ageBand,
        isWoman: state.isWoman, africanDescent: state.africanDescent,
        outsideGhana: state.outsideGhana, validPassport: state.validPassport,
        consentPolicy: state.consentPolicy, consentRefund: state.consentRefund,
        consentMediaUse: state.consentMediaUse, consentMarketing: state.consentMarketing,
        honeypot, turnstileToken: state.turnstileToken,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      if (json.error === 'already_paid_for_cycle') {
        errEl.innerHTML = '';
        errEl.appendChild(document.createTextNode(
          json.message || 'You have already paid for this cycle.'
        ));
        errEl.appendChild(document.createTextNode(' '));
        const link = document.createElement('a');
        link.href = json.recoverUrl || '/apply/recover';
        link.textContent = 'Recover your application link';
        errEl.appendChild(link);
        errEl.style.display = 'block';
        return;
      }
      errEl.textContent = json.message ?? json.error ?? 'Something went wrong. Please try again.';
      errEl.style.display = 'block';
      return;
    }
    if (json.flow === 'sdk') {
      openPayazaCheckout(json.sdkBootstrap, json.reference, errEl);
      return;
    }
    window.location.href = json.checkoutUrl;
  });
}

function openPayazaCheckout(boot, reference, errEl) {
  if (!window.PayazaCheckout) {
    errEl.textContent = 'Payment widget failed to load. Please refresh and try again.';
    errEl.style.display = 'block';
    return;
  }
  const returnUrl = `/apply/return?reference=${encodeURIComponent(reference)}`;
  const checkout = window.PayazaCheckout.setup({
    merchant_key: boot.publicKey,
    connection_mode: boot.connectionMode,
    checkout_amount: boot.amount,
    currency_code: boot.currency,
    email_address: boot.email,
    first_name: boot.firstName,
    last_name: boot.lastName,
    phone_number: boot.phoneNumber || '',
    transaction_reference: boot.reference,
    callback: (response) => {
      // Log Payaza's full result so a decline can be diagnosed from DevTools.
      try { console.log('[payaza] callback response:', JSON.stringify(response)); }
      catch (_) { console.log('[payaza] callback response:', response); }
      // Stay on Payaza's result/error screen long enough to read it before we
      // navigate to the return page. A clear success redirects immediately.
      let blob = '';
      try { blob = JSON.stringify(response ?? '').toLowerCase(); } catch (_) {}
      const looksSuccessful = /success|completed|"paid"/.test(blob);
      setTimeout(() => { window.location.href = returnUrl; }, looksSuccessful ? 0 : 8000);
    },
    onClose: () => {},
  });
  checkout.showPopup();
}

function showDisqualified(state) {
  const form = document.getElementById('apply-form');
  const card = document.createElement('section');
  card.id = 'disqualified-card';
  card.className = 'card';
  card.style.borderLeft = '3px solid #FF6B6B';
  card.innerHTML = `
    <div class="label" style="color:#FF6B6B">This cycle isn't a fit</div>
    <h3 style="margin:8px 0">But our criteria evolve.</h3>
    <p class="muted">Drop your email and we'll let you know when future cycles open opportunities aligned with your story. (You can unsubscribe any time.)</p>
    <div style="display:flex;gap:8px;margin-top:12px">
      <input id="dq-email" class="input" type="email" placeholder="email@example.com" />
      <button type="button" id="dq-subscribe" class="btn" style="white-space:nowrap">Notify me</button>
    </div>
    <p id="dq-msg" style="font-size:12px;margin-top:8px;display:none"></p>
  `;
  form.parentNode.insertBefore(card, form);
  document.getElementById('dq-subscribe').addEventListener('click', async () => {
    const email = document.getElementById('dq-email').value.trim();
    const msg = document.getElementById('dq-msg');
    msg.style.display = 'block';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'err'; msg.textContent = 'Please enter a valid email.'; return; }
    const rule = ruleFromState(state);
    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'eligibility_disqualified', disqualifyingRule: rule, honeypot: '' }),
    });
    if (res.ok) { msg.className = 'ok'; msg.textContent = "Thanks — we'll be in touch when things open up."; }
    else { msg.className = 'err'; msg.textContent = 'Something went wrong. Try again later.'; }
  });
}

function ruleFromState(s) {
  if (s.ageBand === 'Under 18' || s.ageBand === 'Over 35') return 'age';
  if (s.isWoman === false) return 'gender';
  if (s.africanDescent === false) return 'heritage';
  if (s.outsideGhana === false) return 'residency';
  if (s.validPassport === false) return 'passport';
  return null;
}
