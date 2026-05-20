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
    consentPolicy: false, email: '', turnstileToken: null,
  };

  renderQuiz(state, validate);
  setupBinaryToggles(state, validate);
  setupCheckbox(state, validate);
  setupEmail(state, validate);
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
      state.consentPolicy && state.consentMediaUse !== null && state.consentMarketing !== null &&
      isValidEmail(state.email) && !!state.turnstileToken;

    document.getElementById('submit-btn').disabled = !(eligible && allAnswered);

    const dq = document.getElementById('disqualified-card');
    if (dq) dq.remove();
    if (state.ageBand && (state.isWoman === false || state.africanDescent === false || state.outsideGhana === false || state.validPassport === false || state.ageBand === 'Under 18' || state.ageBand === 'Over 35')) {
      showDisqualified(state);
    }
  }
}

function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

function renderQuiz(state, validate) {
  const host = document.getElementById('eligibility-quiz');
  const ageRow = document.createElement('div');
  ageRow.innerHTML = `<p style="font-size:13px;margin:0 0 6px">1. What is your age at the start of this cycle?</p>`;
  const ageBtns = document.createElement('div');
  ageBtns.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px';
  AGE_OPTIONS.forEach(band => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-ghost'; b.style.flex = '1 0 0'; b.textContent = band;
    b.addEventListener('click', () => {
      ageBtns.querySelectorAll('.btn-ghost').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected'); state.ageBand = band; validate();
    });
    ageBtns.appendChild(b);
  });
  ageRow.appendChild(ageBtns);
  host.appendChild(ageRow);

  QUESTIONS.forEach((q, i) => {
    const row = document.createElement('div');
    row.style.marginBottom = '14px';
    row.innerHTML = `<p style="font-size:13px;margin:0 0 6px">${i + 2}. ${q.text}</p>`;
    const btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:6px';
    [['Yes', true], ['No', false]].forEach(([label, val]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-ghost'; b.style.flex = '1'; b.textContent = label;
      b.addEventListener('click', () => {
        btns.querySelectorAll('.btn-ghost').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected'); state[q.name] = val; validate();
      });
      btns.appendChild(b);
    });
    row.appendChild(btns); host.appendChild(row);
  });
}

function setupBinaryToggles(state, validate) {
  document.querySelectorAll('.binary-toggle').forEach(group => {
    const name = group.dataset.name;
    group.style.cssText = 'display:flex;gap:8px';
    group.querySelectorAll('button').forEach(b => {
      b.style.flex = '1';
      b.addEventListener('click', () => {
        group.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        state[name] = b.dataset.value === 'true';
        validate();
      });
    });
  });
}

function setupCheckbox(state, validate) {
  const cb = document.querySelector('input[name="consentPolicy"]');
  cb.addEventListener('change', () => { state.consentPolicy = cb.checked; validate(); });
}

function setupEmail(state, validate) {
  const input = document.querySelector('input[name="email"]');
  input.addEventListener('input', () => { state.email = input.value.trim(); validate(); });
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
        email: state.email, ageBand: state.ageBand,
        isWoman: state.isWoman, africanDescent: state.africanDescent,
        outsideGhana: state.outsideGhana, validPassport: state.validPassport,
        consentPolicy: state.consentPolicy,
        consentMediaUse: state.consentMediaUse, consentMarketing: state.consentMarketing,
        honeypot, turnstileToken: state.turnstileToken,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      errEl.textContent = json.error ?? 'Something went wrong. Please try again.';
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
    callback: () => { window.location.href = returnUrl; },
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
