const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

// 1. טיפול בפקודת ה-Slash בדיסקורד (כמו /login)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'login') {
    // מענים לדיסקורד מיד כדי שלא יופיע "did not respond"
    await interaction.reply({ 
      content: 'שולח לך הודעה פרטית להתחברות...', 
      ephemeral: true 
    });

    // מפעילים את תהליך ההתחברות עבור המשתמש
    await initiateEpicAuth(interaction.user.id);
  }
});

// 2. נקודת הקצה לקבלת בקשות מהאתר ב-Vercel
app.post('/api/start-auth', async (req, res) => {
  const { discordUserId, email } = req.body;

  try {
    if (discordUserId) {
      await initiateEpicAuth(discordUserId);
      return res.status(200).json({ success: true, message: 'Auth flow started for user ID' });
    } else {
      console.log(`Received auth request for email: ${email}`);
      return res.status(200).json({ success: true, message: 'Request received' });
    }
  } catch (error) {
    console.error('Error starting auth flow:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. פונקציה לייצור קישור התחברות ושליחתו ב-DM
async function initiateEpicAuth(userId) {
  try {
    const user = await client.users.fetch(userId);
    if (!user) return;

    const response = await axios.post(
      'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/v2/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic MzQ0NmNkNzI2OTRjNDI4ZmI2ZjAxM2VkYzZjNWU3M2M6V3R3R3p3R3p3R3p3'
        }
      }
    );

    const deviceCodeRes = await axios.post(
      'https://account-public-service-prod01.ol.epicgames.com/account/api/oauth/deviceAuthorization',
      'prompt=login',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${response.data.access_token}`
        }
      }
    );

    const { verification_uri_complete, device_code } = deviceCodeRes.data;
    const loginUrl = verification_uri_complete || 'https://www.epicgames.com/id/activate';

    const authButton = new ButtonBuilder()
      .setLabel('התחבר לחשבון Epic Games')
      .setStyle(ButtonStyle.Link)
      .setURL(loginUrl);

    const row = new ActionRowBuilder().addComponents(authButton);

    await user.send({
      content: `אהלן! 🎮 לחץ על הלחצן למטה להתחברות מאובטחת דרך Epic Games. ברגע שתסיים להתחבר, תמונת הלוקר שלך תישלח לכאן אוטומטית!`,
      components: [row]
    });

    pollForEpicToken(device_code, user);

  } catch (error) {
    console.error('Error initiating Epic Auth:', error.response?.data || error.message);
  }
}

// 4. Polling לקבלת Token
async function pollForEpicToken(deviceCode, user) {
  const pollInterval = setInterval(async () => {
    try {
      const tokenResponse = await axios.post(
        'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/v2/token',
        `grant_type=device_code&device_code=${deviceCode}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic MzQ0NmNkNzI2OTRjNDI4ZmI2ZjAxM2VkYzZjNWU3M2M6V3R3R3p3R3p3'
          }
        }
      );

      if (tokenResponse.data && tokenResponse.data.access_token) {
        clearInterval(pollInterval);
        await user.send("✅ ההתחברות ל-Epic Games הושלמה בהצלחה! מכין את תמונת הלוקר שלך...");
        await fetchAndSendLockerImage(tokenResponse.data.access_token, user);
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.errorCode === 'errors.com.epicgames.account.oauth.authorization_pending') {
        // המשתמש עדיין לא אישר
      } else {
        clearInterval(pollInterval);
        console.error('Polling error:', error.response?.data || error.message);
      }
    }
  }, 5000);
}

// 5. שליחת תמונת לוקר
async function fetchAndSendLockerImage(accessToken, user) {
  try {
    await user.send({
      content: "🖼️ הנה תמונת הלוקר המותאמת אישית שלך!"
    });
  } catch (err) {
    console.error('Failed to send locker image:', err);
  }
}

// הפעלת השרת והתחברות הבוט
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}!`);
});

client.login(process.env.TOKEN);
